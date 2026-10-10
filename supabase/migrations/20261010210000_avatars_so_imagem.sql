-- Foto de perfil: o envio aceitava qualquer tipo de arquivo. Agora só imagem.
-- HEIC/HEIF entram porque é o formato padrão da câmera do iPhone.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
WHERE id = 'avatars';
