# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-License-Identifier: AGPL-3.0-only
import logging
from urllib.parse import urlencode
from django.conf import settings
from django.http import HttpRequest
from django.shortcuts import redirect
from django.utils.translation import gettext_lazy as _
from rest_framework import exceptions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from osauth.errors import handle_keycloak_error
from osauth.authentication import OSAuthRequired
from osauth.keycloak import KeycloakError, kc_client_from_settings
from osauth.serializers import TokenResponseSerializer

from app.serializers import UserSerializer
from osauth.authentication import OSAuthRequired

logger = logging.getLogger(__name__)

kc_client = kc_client_from_settings()


class SignInView(APIView):
    serializer_class = TokenResponseSerializer

    def post(self, request: Request):
        try:
            token_resp = kc_client.authenticate(
                request.data["username"],
                request.data["password"],
            )
        except KeyError as e:
            raise exceptions.ParseError(f"Missing {e}")

        serializer = self.serializer_class(
            instance=token_resp, context={"request": request}
        )

        return Response(serializer.data)


class WhoAmIView(APIView):
    authentication_classes = [OSAuthRequired]
    serializer_class = UserSerializer

    def get(self, request: HttpRequest, format=None):
        serializer = self.serializer_class(
            instance=request.user, context={"request": request}
        )
        return Response(serializer.data)


# SSO views


class SSOSignInView(APIView):
    def get(self, request: Request):
        redirect_uri = request.GET.get("redirect_uri")
        if not redirect_uri:
            raise exceptions.APIException("Missing SSO redirect_uri")

        params = {
            "client_id": settings.KEYCLOAK_CLIENT_ID,
            "response_type": "code",
            "scope": "openid email profile",
            "redirect_uri": redirect_uri,
        }

        return redirect(
            f"http://localhost:8080/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/auth?{urlencode(params)}"
        )


class SSOAuthCodeView(APIView):
    serializer_class = TokenResponseSerializer

    def get(self, request: Request):
        code = request.GET.get("code")
        if not code:
            raise exceptions.APIException("Missing SSO authorization code")

        redirect_uri = request.GET.get("redirect_uri")
        if not redirect_uri:
            raise exceptions.APIException("Missing SSO redirect_uri")

        # Fetch access- & refresh-token using the authroization code
        try:
            token_resp = kc_client.token_from_code(code, redirect_uri)
            serializer = self.serializer_class(
                instance=token_resp, context={"request": request}
            )
            return Response(serializer.data)
        except KeycloakError as e:
            handle_keycloak_error(e)
