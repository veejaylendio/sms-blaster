# Implementation Plan: Merge Tag / Chip Composer for Bulk SMS Blast

## Goal
Add a merge-tag (personalization) feature to the **Compose Blast** panel on the Bulk SMS page. Users insert fields from the contact schema; the composer renders them as atomic inline chips; the stored message remains raw `{{field_key}}` syntax; and tags are resolved per recipient at send-time.

---

## 1. Scope & Touch Points

### Files to create
- `src/lib/sms/merge-tags.ts` — shared constants and helpers (field registry, regex, resolve/validate/extract).
- `src/components/sms/merge-tag-composer.tsx` — `contentEditable`-based composer with atomic chips.

### Files to modify
- `src/app/dashboard/bulk-sms/page.tsx` — wire in the new composer, Insert Field control, preview, validation, and effective character count.
- `src/app/api/send-sms/route.ts` — resolve merge tags per contact before queuing `sms_messages` rows.

### Files unchanged
- `src/lib/sms/processor.ts` — keeps sending `message_content` as-is; resolution happens upstream in the API route for blast sends.

---

## 2. Data Model

### Supported merge fields
Registry lives in `src/lib/sms/merge-tags.ts`. Based on the current `contacts` schema (`supabase_schema.sql`):

| Key            | Label        | Fallback | Notes                                  |
|----------------|--------------|----------|----------------------------------------|
| `first_name`   | First Name   | `there`  | Required field                         |
| `last_name`    | Last Name    | *(empty)*| Optional                               |
| `phone_number` | Phone Number | *(empty)*| Useful for "reply to" style messages   |
| `birthday`     | Birthday     | *(empty)*| Date field                             |

The registry is exported as an array and a key-indexed map so it is easy to add custom fields later without touching UI or API code.

### Tag syntax
- Format: `{{field_key}}`
- Whitespace inside braces is tolerated: `{{ first_name }}`.
- Regex: `/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g`

---

## 3. UI Changes

### 3.1 Insert Field control
- Place a small row directly above the existing **SMS Message** label / counter row.
- Use the existing `Select` from `@/components/ui/select` (or a custom dropdown to match the current dark style).
- The trigger shows "Insert Field" with a small down-chevron.
- Options are populated from `MERGE_FIELDS`.
- On selection, call the composer ref method to insert `{{key}}` at the current cursor position.
- After insertion, focus returns to the composer.

### 3.2 Composer (`MergeTagComposer`)
- Replace the current `<Textarea>` in the SMS Message section.
- Use a `contentEditable` `<div>` with Tailwind classes matching the existing textarea look:
  - `bg-black/20`, `border-white/10`, `text-sm`, `rounded-xl`, `focus:border-accent/50`
  - `placeholder:text-text-muted/65` via an empty-state label or pseudo-element.
- **Rendering chips**
  - A render pass converts the raw `messageContent` string into DOM:
    - Plain text → text nodes.
    - `{{key}}` → `<span contenteditable="false" data-field="key" class="...">Label</span>` styled as a rounded teal/accent pill.
  - Chips are `contenteditable="false"` so they are selected/deleted atomically.
- **Raw extraction**
  - On `input`, walk the DOM and reconstruct the raw string:
    - chip spans become `{{data-field}}`
    - text nodes append as-is
  - Call `onChange(raw)` so the parent always stores the raw syntax.
- **Atomic behavior**
  - `Backspace` / `Delete` at the edge of a chip removes the whole `{{key}}` block from the raw string.
  - Pasting plain text is allowed; raw `{{...}}` typed by the user remains literal text until validated.
- **Cursor preservation**
  - Before re-rendering from props (e.g., after an insert), save the cursor offset in raw text using a temporary zero-width marker, rebuild, then restore.
- **Placeholder**
  - When the composer is empty and not focused, show the placeholder text "Enter message content here..." using an absolutely positioned span or CSS `::before`.

### 3.3 Character counter
- Keep the existing counter in the top-right of the SMS Message label.
- Compute effective length by replacing each merge tag with its fallback value:
  ```ts
  const effective = messageContent.replace(MERGE_TAG_REGEX, (_, key) => getFallback(key));
  const charsUsed = effective.length;
  const smsCount = Math.ceil(charsUsed / 160) || 1;
  ```
- This gives a billing-relevant length estimate because real values are close to or larger than fallbacks.

### 3.4 Live preview
- Add a collapsible preview row below the composer.
- Toggle button text: "Preview with sample contact" / "Hide preview".
- Resolve the raw message against the first contact in the loaded `contacts` array (or fallback values if no contacts).
- Show the resolved text in a subtle muted box.
- If an unknown tag is present, show it highlighted in the preview so the user notices.

### 3.5 Validation
- Extract all tags from `messageContent`.
- If any key is not in `MERGE_FIELDS`, show an inline warning below the composer:
  - Amber text, warning icon.
  - Example: `Unknown merge tag: {{midle_name}}. Check your spelling.`
- Disable the **Send SMS Blast** button while an unknown tag exists (in addition to the existing empty-message check).

---

## 4. API / Send-Time Resolution

### Where to resolve
In `src/app/api/send-sms/route.ts`, after fetching `targetContacts` and before building `messagesToInsert`.

### Resolution function (`resolveMergeTags`)
```ts
function resolveMergeTags(template: string, contact: Contact, fields: MergeField[]): string {
  return template.replace(MERGE_TAG_REGEX, (match, key) => {
    const field = fields.find(f => f.key === key);
    if (!field) return match; // keep unknown tags as-is; UI already blocks send

    const value = contact[key as keyof Contact];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }

    if (field.fallback && field.fallback.trim() !== '') {
      return field.fallback;
    }

    // Log missing value + no fallback
    console.warn(`[send-sms] Missing value for merge tag "${key}" for contact ${contact.id}; no fallback configured.`);
    return match; // keep raw tag so it is obvious in the sent message / log
  });
}
```

### Building messages
```ts
const messagesToInsert = targetContacts.map((contact, index) => {
  const assignedDevice = devices[index % devices.length];
  return {
    contact_id: contact.id,
    android_device_id: assignedDevice.id,
    message_content: resolveMergeTags(messageContent, contact, MERGE_FIELDS),
    status: 'pending',
    scheduled_send_at: new Date().toISOString(),
  };
});
```

### Fetching required contact columns
- Update the contacts query in the route to select `birthday` in addition to `id, first_name, last_name, phone_number`.
- Keep the existing round-robin device assignment and immediate processing for `mymobkit` unchanged.

---

## 5. State Flow

1. User types or inserts a tag in the composer.
2. Composer extracts raw string and calls `setMessageContent(raw)`.
3. Parent derives:
   - effective char count from raw + fallbacks,
   - unknown-tag warning,
   - preview from first contact.
4. On submit, parent POSTs the raw `messageContent` plus audience selection to `/api/send-sms`.
5. API resolves tags per contact and inserts resolved `message_content` rows into `sms_messages`.
6. Existing processor sends the resolved text.

---

## 6. Edge Cases & Handling

| Scenario                              | Handling                                                                 |
|---------------------------------------|--------------------------------------------------------------------------|
| User types raw `{{foo}}`              | Treated as literal text; validation flags unknown tag.                   |
| Merge field has no value and no fallback | Logs warning; keeps raw tag in resolved message for visibility.         |
| Composer is empty                     | Placeholder shown; existing empty-message validation prevents send.      |
| Cursor not in composer on insert      | Inserts at end of message.                                               |
| Multiple adjacent chips               | DOM walk preserves order; cursor logic handles zero-width spaces.        |
| Pasting rich content                  | Strip to plain text via `paste` handler to avoid foreign markup.         |
| Mobile / touch selection              | Chip spans are atomic; native selection handles them as single units.    |

---

## 7. Styling Conventions

- Use existing Tailwind tokens: `bg-black/20`, `border-white/10`, `text-white`, `text-text-muted`, `bg-accent`, `rounded-xl`.
- Chips: `inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent/20 text-accent border border-accent/30 text-xs font-medium`.
- Warning: `text-amber-400` with `AlertCircle` icon (already imported in the page).
- Toggle link: same `text-[10px] uppercase tracking-wider text-accent hover:underline` pattern used for "Clear All" in the contact list.

---

## 8. Verification Checklist

- [ ] Insert Field dropdown lists all registered fields.
- [ ] Clicking a field inserts a chip at cursor position.
- [ ] Chips render inline with rounded pill styling and show field labels.
- [ ] Selecting or deleting a chip removes the whole `{{key}}` block.
- [ ] `messageContent` state always stores raw `{{key}}` syntax.
- [ ] Character counter increases by the fallback length for each tag.
- [ ] Preview resolves tags using the first contact and fallback values.
- [ ] Unknown tags trigger an inline warning and disable Send.
- [ ] API resolves tags per contact before inserting `sms_messages`.
- [ ] Missing-value warnings are logged server-side.
- [ ] Existing send pipeline (mymobkit immediate processing, broadcast log) still works.
