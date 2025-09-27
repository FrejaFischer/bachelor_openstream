Local MinIO service for development

This folder holds data for the local MinIO instance used in development.

Default credentials (for development only):
- Access Key: minioadmin
- Secret Key: minioadmin

Compose service:
- API: http://localhost:9000
- Console: http://localhost:9001

The compose stack in the repo adds the `minio` service. The Django backend will use S3 if the `AWS_S3_KEY`, `AWS_S3_SECRET`, and `AWS_S3_BUCKET` (or `DO_SPACE_*`) environment variables are set in `dev-environment/backend/openstream.env`.
