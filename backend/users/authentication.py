from django.conf import settings
from django.contrib.auth import HASH_SESSION_KEY, SESSION_KEY, BACKEND_SESSION_KEY
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import constant_time_compare
from django.contrib.sessions.backends.db import SessionStore

from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed


def user_from_api_session_key(session_key):
    if not session_key or len(session_key) > 64:
        return None

    session = SessionStore(session_key=session_key)
    user_id = session.get(SESSION_KEY)
    backend_path = session.get(BACKEND_SESSION_KEY)
    session_auth_hash = session.get(HASH_SESSION_KEY)
    if (
        user_id is None
        or backend_path not in settings.AUTHENTICATION_BACKENDS
        or not session_auth_hash
    ):
        return None

    try:
        user = get_user_model()._default_manager.get(
            pk=user_id,
            is_active=True,
        )
    except (get_user_model().DoesNotExist, ValueError, TypeError):
        return None

    if not constant_time_compare(session_auth_hash, user.get_session_auth_hash()):
        session.delete()
        return None

    return user


class TabSessionAuthentication(BaseAuthentication):
    """Authenticate API requests with a per-tab Django session key."""

    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts:
            return None
        if parts[0].lower() != b"bearer":
            return None
        if len(parts) != 2:
            raise AuthenticationFailed("Invalid session credentials.")

        try:
            session_key = parts[1].decode("ascii")
        except UnicodeDecodeError as error:
            raise AuthenticationFailed("Invalid session credentials.") from error

        user = user_from_api_session_key(session_key)
        if user is None:
            raise AuthenticationFailed("Your session has expired. Please sign in again.")
        return user, session_key

    def authenticate_header(self, request):
        return "Bearer"
