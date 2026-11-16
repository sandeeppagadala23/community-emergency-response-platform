from django.apps import AppConfig


class EmergencyAlertsConfig(AppConfig):
    name = 'emergency_alerts'

    def ready(self):
        from . import signals  # noqa: F401
