import json

from django.conf import settings
from django.contrib.auth import (
    BACKEND_SESSION_KEY,
    HASH_SESSION_KEY,
    SESSION_KEY,
    authenticate,
)
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.contrib.sessions.backends.db import SessionStore
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import UserProfile
from .authentication import user_from_api_session_key


def _read_payload(request):
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _error(code, message, status):
    return JsonResponse({'code': code, 'message': message}, status=status)


def _user_data(user):
    profile = UserProfile.objects.filter(user=user).first()
    flats = list(
        user.flats.select_related('block', 'block__society').order_by(
            'block__name',
            'flat_number',
        )
    )
    flat = ', '.join(
        f'{assignment.block.name}-{assignment.flat_number}'
        for assignment in flats
    ) or 'Not assigned'
    societies = sorted({assignment.block.society.name for assignment in flats})
    role = 'ADMIN' if user.is_staff or user.is_superuser else (
        profile.role.upper() if profile else 'RESIDENT'
    )
    return {
        'id': str(user.pk),
        'name': user.get_full_name().strip() or user.username,
        'role': role,
        'flat': flat,
        'society': ', '.join(societies) or 'Not assigned',
        'phone': profile.phone_number if profile else '',
        'email': user.email,
        'is_verified': (
            user.is_staff
            or user.is_superuser
            or (profile is not None and profile.is_verified)
        ),
    }


def _session_data(user, backend):
    session = SessionStore()
    session[SESSION_KEY] = str(user.pk)
    session[BACKEND_SESSION_KEY] = backend
    session[HASH_SESSION_KEY] = user.get_session_auth_hash()
    session.set_expiry(12 * 60 * 60)
    session.create()
    return {'token': session.session_key, 'user': _user_data(user)}


def _bearer_session_key(request):
    authorization = request.headers.get('Authorization', '').split()
    if not authorization:
        return None
    if len(authorization) != 2 or authorization[0].lower() != 'bearer':
        return ''
    return authorization[1]


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({'csrfToken': get_token(request)})


def _username_for_identifier(identifier):
    user = User.objects.filter(email__iexact=identifier).first()
    if user:
        return user.username

    profile = UserProfile.objects.select_related('user').filter(
        phone_number=identifier
    ).first()
    if profile:
        return profile.user.username

    user = User.objects.filter(username__iexact=identifier).first()
    return user.username if user else identifier


@require_POST
def login_api(request):
    payload = _read_payload(request)
    if payload is None:
        return _error('INVALID_REQUEST', 'A JSON request body is required.', 400)

    identifier = str(payload.get('identifier', '')).strip()
    password = payload.get('password', '')
    if not identifier or not isinstance(password, str) or not password:
        return _error('INVALID_REQUEST', 'Username and password are required.', 400)

    user = authenticate(
        request,
        username=_username_for_identifier(identifier),
        password=password,
    )
    if user is None:
        return _error('INVALID_CREDENTIALS', 'Invalid identifier or password.', 401)

    backend = getattr(user, 'backend', settings.AUTHENTICATION_BACKENDS[0])
    return JsonResponse(_session_data(user, backend))


@require_POST
def register_api(request):
    payload = _read_payload(request)
    if payload is None:
        return _error('INVALID_REQUEST', 'A JSON request body is required.', 400)

    raw_fields = {
        field: payload.get(field)
        for field in ('username', 'email', 'phone_number')
    }
    if any(not isinstance(value, str) for value in raw_fields.values()):
        return _error('INVALID_REQUEST', 'Account details must be text.', 400)

    username = raw_fields['username'].strip()
    email = raw_fields['email'].strip()
    phone_number = raw_fields['phone_number'].strip()
    password = payload.get('password', '')
    confirm_password = payload.get('confirm_password', '')

    if not all((username, email, phone_number)) or not password or not confirm_password:
        return _error('INVALID_REQUEST', 'Please fill in all fields.', 400)
    if not isinstance(password, str) or not isinstance(confirm_password, str):
        return _error('INVALID_REQUEST', 'Password values must be text.', 400)
    if len(username) > User._meta.get_field('username').max_length:
        return _error('INVALID_USERNAME', 'Username must be 150 characters or fewer.', 400)
    if len(email) > User._meta.get_field('email').max_length:
        return _error('INVALID_EMAIL', 'Email must be 254 characters or fewer.', 400)
    if len(phone_number) > UserProfile._meta.get_field('phone_number').max_length:
        return _error('INVALID_PHONE', 'Phone number must be 15 characters or fewer.', 400)
    try:
        User._meta.get_field('username').run_validators(username)
    except ValidationError as error:
        return _error('INVALID_USERNAME', ' '.join(error.messages), 400)
    try:
        validate_email(email)
    except ValidationError:
        return _error('INVALID_EMAIL', 'Please enter a valid email address.', 400)
    if password != confirm_password:
        return _error('PASSWORD_MISMATCH', 'Passwords do not match.', 400)
    candidate_user = User(username=username, email=email)
    try:
        validate_password(password, user=candidate_user)
    except ValidationError as error:
        return _error('WEAK_PASSWORD', ' '.join(error.messages), 400)
    if User.objects.filter(username__iexact=username).exists():
        return _error('USERNAME_TAKEN', 'This username is already taken.', 400)
    if User.objects.filter(email__iexact=email).exists():
        return _error('EMAIL_TAKEN', 'This email is already registered.', 400)
    if UserProfile.objects.filter(phone_number=phone_number).exists():
        return _error('PHONE_TAKEN', 'This phone number is already registered.', 400)

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
            )
            UserProfile.objects.create(
                user=user,
                role='resident',
                phone_number=phone_number,
            )
    except IntegrityError:
        return _error('REGISTRATION_CONFLICT', 'Account details are already in use.', 400)

    return JsonResponse(
        _session_data(user, settings.AUTHENTICATION_BACKENDS[0]),
        status=201,
    )


@require_GET
def current_user_api(request):
    session_key = _bearer_session_key(request)
    user = user_from_api_session_key(session_key)
    if user is None:
        return _error('UNAUTHORIZED', 'Please sign in again.', 401)
    return JsonResponse(_user_data(user))


@require_POST
def logout_api(request):
    session_key = _bearer_session_key(request)
    if not session_key or user_from_api_session_key(session_key) is None:
        return _error('UNAUTHORIZED', 'Please sign in again.', 401)
    SessionStore(session_key=session_key).delete()
    return JsonResponse({'ok': True})