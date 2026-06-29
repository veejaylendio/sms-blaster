-- Junction table for many-to-many contact ↔ group relationship
CREATE TABLE public.contact_group_memberships (
  contact_id uuid REFERENCES public.contacts (id) ON DELETE CASCADE NOT NULL,
  group_id   uuid REFERENCES public.contact_groups (id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (contact_id, group_id)
);

ALTER TABLE public.contact_group_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own contact group memberships."
  ON public.contact_group_memberships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_group_memberships.contact_id
        AND contacts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_group_memberships.contact_id
        AND contacts.user_id = auth.uid()
    )
  );

-- Migrate existing single group_id values into the new junction table
INSERT INTO public.contact_group_memberships (contact_id, group_id)
SELECT id, group_id
FROM public.contacts
WHERE group_id IS NOT NULL
ON CONFLICT DO NOTHING;
