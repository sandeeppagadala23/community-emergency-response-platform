from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ResponderAssignment
from .notification_service import create_assignment_notification
from users.models import UserProfile


@receiver(post_save, sender=ResponderAssignment)
def notify_assigned_responder(sender, instance, created, **kwargs):
    if not created:
        return
    profile = UserProfile.objects.filter(user_id=instance.responder_id).first()
    if profile is None:
        return
    if (
        profile.is_verified
        and profile.role in {"security", "volunteer"}
        and instance.responder.is_active
    ):
        create_assignment_notification(instance)
