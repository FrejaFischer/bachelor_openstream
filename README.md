# OpenStream

This folder contains OpenStream, an open-source digital signage system designed for digital display. The system allows organizations to collect and centralize all their digital signage solutions into one shared platform.

OpenStream was originally developed in Denmark in response to municipalities' growing demand for a unified and flexible solution for managing digital displays.

Features

With OpenStream you can:

-Manage content across multiple screens from one central location.
-Display various content types such as news, videos, calendars, and data from external sources.
-Customize views to specific needs with a user-friendly interface.

OpenStream is designed to be a versatile and scalable solution that can be adapted to the needs of both small and large organizations for information sharing.

The system was developed by Magenta Aps (https://www.magenta.dk)

For more information about the OpenStream project, please see the official home page:
https://www.magenta.dk/en/solutions/openstream-english/ 

All code is made available under Version 3 of the AGPL  GNU Affero General Public License
License - see the LICENSE file for details.

Local S3 for development
------------------------

The development compose stack includes a local MinIO service that provides an S3-compatible API. Start the compose stack and the MinIO console will be available at http://localhost:9001 and the S3 API at http://localhost:9000.

Defaults used in development (see `dev-environment/backend/openstream.env`):
- Access Key: minioadmin
- Secret Key: minioadmin
- Bucket: infoscreen

Set `AWS_S3_ENDPOINT_URL=http://minio:9000` (or `DO_SPACE_*` if you use DigitalOcean Spaces) to control which storage backend the Django app uses.