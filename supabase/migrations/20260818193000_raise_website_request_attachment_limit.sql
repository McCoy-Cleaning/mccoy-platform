-- Direct browser-to-storage uploads bypass Vercel's fixed 4.5 MB function
-- payload ceiling. Keep the bucket private and enforce a bounded 25 MB limit
-- per file at the storage layer as well as in application validation.

update storage.buckets
set file_size_limit = 26214400,
    public = false,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'website-request-attachments';

-- Deliberately no storage.objects policy: upload tokens are path-scoped and
-- all reads require trusted server authorization plus a short-lived URL.
