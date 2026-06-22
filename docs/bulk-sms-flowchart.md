# Bulk SMS System Flowchart

```mermaid
flowchart TD
    A([User fills in message and contacts in Web App UI]) --> B

    subgraph WEBAPP["Web App"]
        B["POST /bulk-sms to Python Service
        payload: message + contacts array"]
        B --> C["Create one DB entry per contact
        Initial status: pending"]
        C --> T["Render SMS Progress Table
        with live progress bar"]
    end

    B --> D

    subgraph PYTHON["Python Service"]
        D["Receive bulk SMS request"] --> E["Parse message and contacts array"]
        E --> F{"More contacts in loop?"}

        F -- Yes --> G["Pick next contact number"]
        G --> H["POST to Android SMS Gateway
        http://phone_ip:8080/sendsms
        ?phone=number &text=message"]

        H --> I{"SMS Gateway Response"}

        I -- "HTTP 200 OK" --> J["Mark status: sent"]
        I -- "Error / Timeout" --> K["Mark status: failed"]

        J --> L["Callback to Supabase Edge Function
        update-sms-status?phone=number&status=sent"]
        K --> L2["Callback to Supabase Edge Function
        update-sms-status?phone=number&status=failed"]

        L --> F
        L2 --> F

        F -- "No - all done" --> N(["Bulk send complete"])
    end

    subgraph MOBKIT["Android SMS Gateway - Mobkit App
    192.168.254.XXX:8080"]
        H --> MK["Send SMS via device SIM card"]
        MK --> I
    end

    subgraph SUPABASE["Supabase"]
        L --> SU1["Edge Function: update-sms-status
        UPDATE bulk_sms_entries
        SET status = sent
        WHERE phone = number"]
        L2 --> SU2["Edge Function: update-sms-status
        UPDATE bulk_sms_entries
        SET status = failed
        WHERE phone = number"]
    end

    SU1 --> RT["Realtime DB change broadcast to Web App"]
    SU2 --> RT
    RT --> T

    subgraph TABLE["Web App Progress Table"]
        T --> TB["Contact | Status  | Progress
        09123123    | sent    | done
        0912312312  | failed  | done
        091231231   | pending | waiting
        Overall: 2 of 3 sent - progress bar"]
    end
```

---

## Component Responsibilities

| Component | Role |
|---|---|
| **Web App** | Initiates bulk SMS, creates DB records per contact, renders live progress table |
| **Python Service** | Loops contacts, calls SMS gateway, fires status callbacks to Supabase |
| **Android SMS Gateway (Mobkit)** | Sends actual SMS via device SIM on local network (`192.168.254.XXX:8080`) |
| **Supabase Edge Function** | Updates each contact's status in the database |
| **Web App Table** | Polls or subscribes (realtime) to DB and reflects status + progress bar live |

---

## API Summary

### Web App → Python Service
```
POST /bulk-sms
Content-Type: application/json

{
  "message": "message text here",
  "contacts": ["09123123", "0912312312", "091231231"]
}
```

### Python Service → Mobkit SMS Gateway
```
POST http://<phone_ip_address>:8080/sendsms
      ?phone=<recipient_number>
      &text=<message_content>
```

### Python Service → Supabase Edge Function (callback)
```
POST https://adada.supabase.com/update-sms-status
      ?phone=<recipient_number>
      &status=<sent|failed>
```

---

## Status Lifecycle

```
pending  ──► sending  ──► sent
                     └──► failed
```
