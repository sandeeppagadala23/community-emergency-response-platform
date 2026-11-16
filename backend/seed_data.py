import os
import django
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from users.models import UserProfile
from society.models import Society, Block, Flat
from emergency_contacts.models import EmergencyContact, GuardianContact
from emergency_alerts.models import SOSAlert, SOSAlertEvent, SOSNotification

def run_seed():
    print("Seeding database with realistic community emergency data...")

    # 1. Society, Block, Flat
    society, _ = Society.objects.get_or_create(
        name="Green Meadows Apartments",
        defaults={
            "address": "Sarjapur - Marathahalli Outer Ring Road, Bellandur",
            "city": "Bengaluru",
            "pincode": "560103"
        }
    )

    block_b, _ = Block.objects.get_or_create(society=society, name="B Block")
    block_c, _ = Block.objects.get_or_create(society=society, name="C Block")

    flat_b304, _ = Flat.objects.get_or_create(block=block_b, flat_number="B-304", floor_number=3)
    flat_b102, _ = Flat.objects.get_or_create(block=block_b, flat_number="B-102", floor_number=1)
    flat_c101, _ = Flat.objects.get_or_create(block=block_c, flat_number="C-101", floor_number=1)

    # 2. Users & Profiles
    personas = [
        {
            "username": "shanti.sharma",
            "first_name": "Shanti",
            "last_name": "Sharma",
            "email": "shanti.sharma@example.in",
            "role": "resident",
            "phone": "+91 98450 11223",
            "flat": flat_b304,
            "is_verified": True
        },
        {
            "username": "arun.sharma",
            "first_name": "Arun",
            "last_name": "Sharma",
            "email": "arun.sharma@example.in",
            "role": "guardian",
            "phone": "+91 98450 88771",
            "flat": None,
            "is_verified": True
        },
        {
            "username": "priya.nair",
            "first_name": "Priya",
            "last_name": "Nair",
            "email": "priya.nair@example.in",
            "role": "volunteer",
            "phone": "+91 99012 33445",
            "flat": flat_b102,
            "is_verified": True
        },
        {
            "username": "ramesh.gate1",
            "first_name": "Ramesh",
            "last_name": "Kumar",
            "email": "security.gate1@greenmeadows.in",
            "role": "security",
            "phone": "+91 80 2844 5500",
            "flat": None,
            "is_verified": True
        },
        {
            "username": "sunita.admin",
            "first_name": "Sunita",
            "last_name": "Rao",
            "email": "manager@greenmeadows.in",
            "role": "admin",
            "phone": "+91 98800 66554",
            "flat": None,
            "is_verified": True,
            "is_superuser": True
        }
    ]

    created_users = {}
    for p in personas:
        user, created = User.objects.get_or_create(
            username=p["username"],
            defaults={
                "first_name": p["first_name"],
                "last_name": p["last_name"],
                "email": p["email"],
                "is_staff": p.get("is_superuser", False),
                "is_superuser": p.get("is_superuser", False)
            }
        )
        user.set_password("pass123")
        user.save()

        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                "role": p["role"],
                "phone_number": p["phone"],
                "is_verified": p["is_verified"]
            }
        )
        profile.role = p["role"]
        profile.phone_number = p["phone"]
        profile.is_verified = p["is_verified"]
        profile.save()

        if p.get("flat"):
            p["flat"].residents.add(user)

        created_users[p["username"]] = user

    # 3. Guardian link
    shanti = created_users["shanti.sharma"]
    arun = created_users["arun.sharma"]
    GuardianContact.objects.get_or_create(
        resident=shanti,
        guardian_type="PRIMARY",
        defaults={
            "name": "Mr. Arun Sharma",
            "relationship": "Son",
            "phone_number": "+91 98450 88771",
            "email": "arun.sharma@example.in",
            "is_verified": True
        }
    )

    # 4. Emergency Contacts
    EmergencyContact.objects.get_or_create(
        society=society,
        name="Main Gate Security Desk",
        service_type="OTHER",
        defaults={
            "phone_number": "+91 80 2844 5500",
            "address": "Security Control Cabin, Gate 1",
            "is_active": True
        }
    )
    EmergencyContact.objects.get_or_create(
        society=society,
        name="HAL Police Station",
        service_type="POLICE",
        defaults={
            "phone_number": "112",
            "address": "HAL Airport Road",
            "is_active": True
        }
    )
    EmergencyContact.objects.get_or_create(
        society=society,
        name="Manipal Hospital Whitefield Ambulance",
        service_type="AMBULANCE",
        defaults={
            "phone_number": "+91 80 2502 4444",
            "address": "ITPL Main Road",
            "is_active": True
        }
    )

    # 5. Seed SOS Alert
    alert, created = SOSAlert.objects.get_or_create(
        pk=1,
        defaults={
            "reporter": shanti,
            "category": "MEDICAL",
            "message": "Severe shortness of breath and chest pressure",
            "latitude": 12.924900,
            "longitude": 77.674800,
            "location_text": "B-304, Green Meadows, Bengaluru",
            "status": "PENDING",
        }
    )

    if created:
        SOSAlertEvent.objects.create(
            alert=alert,
            actor=shanti,
            event_type="CREATED",
            description="SOS alert created from mobile resident interface."
        )

        # Create notifications
        ramesh = created_users["ramesh.gate1"]
        priya = created_users["priya.nair"]

        # In-App notification for Guardian
        SOSNotification.objects.create(
            alert=alert,
            recipient=arun,
            channel="IN_APP",
            status="PENDING",
            title="Emergency Medical SOS",
            notification_type="SOS_ALERT",
            message="EMERGENCY: Medical SOS triggered by your mother Mrs. Shanti Sharma at Flat B-304."
        )

        # Simulated SMS notification
        arun_contact = GuardianContact.objects.filter(resident=shanti, email__iexact=arun.email).first()
        SOSNotification.objects.create(
            alert=alert,
            recipient=arun,
            guardian_contact=arun_contact,
            destination=arun_contact.phone_number if arun_contact else "+91 98450 88771",
            channel="SMS",
            status="SIMULATED",
            message="EMERGENCY: Medical SOS triggered by your mother Mrs. Shanti Sharma at Flat B-304."
        )
        SOSNotification.objects.create(
            alert=alert,
            recipient=ramesh,
            channel="IN_APP",
            status="SENT",
            message="URGENT: Medical SOS at Flat B-304 (Mrs. Shanti Sharma)."
        )
        SOSNotification.objects.create(
            alert=alert,
            recipient=priya,
            channel="IN_APP",
            status="SENT",
            message="VOLUNTEER ALERT: Medical emergency in Block B Flat 304."
        )

    print("Seeding completed successfully!")

if __name__ == '__main__':
    run_seed()
