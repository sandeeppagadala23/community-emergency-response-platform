
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    EmergencyContactViewSet,
    GuardianContactViewSet,
)

router = DefaultRouter()

router.register(
    "emergency-contacts",
    EmergencyContactViewSet,
    basename="emergency-contact"
)

router.register(
    "guardian-contacts",
    GuardianContactViewSet,
    basename="guardian-contact"
)

urlpatterns = [
    path("", include(router.urls)),
]
