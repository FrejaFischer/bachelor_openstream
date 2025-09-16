# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-License-Identifier: AGPL-3.0-only
import requests
from django.shortcuts import redirect
from urllib.parse import urlencode
from django.http import HttpResponseBadRequest
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.conf import settings


# URLs
URL_KEYCLOAK_REALM = f"{settings.KEYCLOAK_HOST}/realms/{settings.KEYCLOAK_REALM}"
URL_KEYCLOAK_TOKEN = f"{URL_KEYCLOAK_REALM}/protocol/openid-connect/token"
URL_KEYCLOAK_USER_INFO = f"{URL_KEYCLOAK_REALM}/protocol/openid-connect/token"


def sso_login(request):
    redirect_uri = request.build_absolute_uri("/sso/callback/")

    params = {
        "client_id": "openstream",
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": redirect_uri,
    }

    # IMPORTANT! FRONTEND REDIRECT which
    return redirect(
        f"http://localhost:8080/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/auth?{urlencode(params)}"
    )


def sso_callback(request):
    code = request.GET.get("code")
    if not code:
        return HttpResponseBadRequest("Missing code")

    # Get access token, so we can fetch the user infomation etc.
    redirect_uri = request.build_absolute_uri("/sso/callback/")

    data = {
        "client_id": "openstream",
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }

    token_response = requests.post(URL_KEYCLOAK_TOKEN, data=data)
    token_data = token_response.json()

    # Extract user info
    userinfo_response = requests.get(
        URL_KEYCLOAK_USER_INFO,
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
    )

    print("UserInfo status code:", userinfo_response.status_code)
    print("UserInfo response text:", userinfo_response.text)

    try:
        user_info = userinfo_response.json()
    except requests.exceptions.JSONDecodeError as e:
        print(userinfo_response)
        print("Failed to decode JSON:", e)
        return HttpResponse(
            f"Userinfo JSON error: {e} — Raw response: {userinfo_response.text}",
            status=500,
        )

    # Get, or create, the user
    User = get_user_model()
    user, _ = User.objects.get_or_create(username=user_info["preferred_username"])
    # login(request, user)

    return HttpResponse(f"<b>GOT THROUGH!</b> <br/> <span>{user.username}</span>")
