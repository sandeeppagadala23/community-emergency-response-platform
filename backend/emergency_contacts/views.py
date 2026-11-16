
import logging
import secrets
import smtplib
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response

from .models import ContactVerificationOTP, EmergencyContact, GuardianContact
from .serializers import (
    EmergencyContactSerializer,
    GuardianContactSerializer,
)

logger = logging.getLogger(__name__)
OTP_EXPIRY = timedelta(minutes=10)
OTP_RESEND_COOLDOWN = timedelta(seconds=60)
OTP_MAX_ATTEMPTS = 5


class IsAdminOrReadOnly(BasePermission):
    """
    Authenticated users can read emergency contacts.
    Only staff users and superusers can modify them.
    """

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True

        return user.is_staff or user.is_superuser


class EmergencyContactViewSet(viewsets.ModelViewSet):
    queryset = EmergencyContact.objects.select_related(
        "society"
    ).all().order_by("id")

    serializer_class = EmergencyContactSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]


class GuardianContactViewSet(viewsets.ModelViewSet):
    serializer_class = GuardianContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        queryset = GuardianContact.objects.select_related(
            "resident"
        )

        if user.is_staff or user.is_superuser:
            return queryset.all().order_by("id")

        return queryset.filter(
            resident=user
        ).order_by("id")

    def perform_create(self, serializer):
        # Always assign the contact to the logged-in user.
        serializer.save(resident=self.request.user)

    def perform_update(self, serializer):
        contact = serializer.instance
        email = serializer.validated_data.get("email", contact.email)
        phone_number = serializer.validated_data.get(
            "phone_number",
            contact.phone_number,
        )
        changed_contact_details = (
            email != contact.email or phone_number != contact.phone_number
        )
        with transaction.atomic():
            serializer.save(
                is_verified=False if changed_contact_details else contact.is_verified
            )
            if changed_contact_details:
                contact.verification_otps.filter(is_used=False).update(is_used=True)

    @action(detail=True, methods=["post"], url_path="send-otp")
    def send_otp(self, request, pk=None):
        contact = self.get_object()
        now = timezone.now()
        latest_otp = contact.verification_otps.first()
        if latest_otp and now < latest_otp.created_at + OTP_RESEND_COOLDOWN:
            return Response(
                {
                    "detail": "Wait before requesting another verification code.",
                    "retry_after": max(
                        1,
                        int(
                            (
                                latest_otp.created_at
                                + OTP_RESEND_COOLDOWN
                                - now
                            ).total_seconds()
                        ),
                    ),
                    "code": "OTP_COOLDOWN",
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        code = f"{secrets.randbelow(1_000_000):06d}"
        with transaction.atomic():
            contact.verification_otps.filter(is_used=False).update(is_used=True)
            otp = ContactVerificationOTP.objects.create(
                contact=contact,
                code_hash=make_password(code),
                expires_at=now + OTP_EXPIRY,
            )

        if contact.email:
            try:
                send_mail(
                    subject="Emergency contact verification code",
                    message=(
                        f"Your emergency contact verification code is {code}. "
                        "It expires in 10 minutes."
                    ),
                    from_email=None,
                    recipient_list=[contact.email],
                    fail_silently=False,
                )
                channel = "EMAIL"
            except (OSError, smtplib.SMTPException):
                otp.is_used = True
                otp.save(update_fields=["is_used"])
                logger.exception("Could not write emergency contact OTP to console email.")
                return Response(
                    {"detail": "The simulated email could not be written to the backend console."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        else:
            logger.info(
                "SIMULATED SMS OTP to %s for guardian contact #%s: %s",
                contact.phone_number,
                contact.pk,
                code,
            )
            channel = "SMS"

        return Response(
            {
                "detail": (
                    "Verification code written to the Django console for simulated "
                    "delivery; no SMS or email was sent externally."
                ),
                "channel": channel,
                "simulated": True,
                "expires_at": otp.expires_at,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="verify-otp")
    def verify_otp(self, request, pk=None):
        contact = self.get_object()
        code = request.data.get("code")
        if not isinstance(code, str) or len(code) != 6 or not code.isdigit():
            raise ValidationError({"code": "Enter the six-digit verification code."})

        verification_error = None
        with transaction.atomic():
            otp = (
                ContactVerificationOTP.objects.select_for_update()
                .filter(contact=contact, is_used=False)
                .order_by("-created_at")
                .first()
            )
            if otp is None:
                verification_error = "Request a new verification code before verifying."
            elif otp.is_expired:
                otp.is_used = True
                otp.save(update_fields=["is_used"])
                verification_error = "The verification code expired. Request a new one."
            elif otp.attempts >= OTP_MAX_ATTEMPTS:
                otp.is_used = True
                otp.save(update_fields=["is_used"])
                verification_error = "Too many attempts. Request a new verification code."
            elif not check_password(code, otp.code_hash):
                otp.attempts += 1
                if otp.attempts >= OTP_MAX_ATTEMPTS:
                    otp.is_used = True
                otp.save(update_fields=["attempts", "is_used"])
                verification_error = (
                    "Too many attempts. Request a new code."
                    if otp.is_used
                    else "The verification code is incorrect."
                )
            else:
                otp.is_used = True
                otp.save(update_fields=["is_used"])
                contact.is_verified = True
                contact.save(update_fields=["is_verified"])
                contact.verification_otps.filter(is_used=False).update(is_used=True)

        if verification_error:
            raise ValidationError({"code": verification_error})

        return Response(
            {
                "detail": "Emergency contact verified successfully.",
                "id": contact.pk,
                "is_verified": True,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="verify")
    def verify(self, request, pk=None):
        """
        Allow only staff users or superusers to verify a guardian.
        """
        if not (
            request.user.is_staff
            or request.user.is_superuser
        ):
            return Response(
                {
                    "detail": (
                        "Only administrators can verify guardians."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        guardian = self.get_object()
        guardian.is_verified = True
        guardian.save(update_fields=["is_verified"])

        return Response(
            {
                "detail": (
                    "Guardian contact verified successfully."
                ),
                "id": guardian.id,
                "is_verified": guardian.is_verified,
            },
            status=status.HTTP_200_OK
        )
