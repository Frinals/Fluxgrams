/*
# Storage policies for chat-media bucket

Allows authenticated users to upload, read, and manage their own media files
in the chat-media bucket. All files are public-readable so chat participants
can view images, videos, and voice messages.
*/

CREATE POLICY "chat_media_read_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');

CREATE POLICY "chat_media_insert_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "chat_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'chat-media' AND owner = auth.uid());

CREATE POLICY "chat_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-media' AND owner = auth.uid());