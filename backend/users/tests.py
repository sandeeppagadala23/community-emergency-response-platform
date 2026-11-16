
from django.test import Client, TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from django.conf import settings
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY
from django.contrib.sessions.backends.db import SessionStore

from society.models import Block, Flat, Society
from .models import UserProfile


class UserAuthenticationTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testresident",
            email="resident@example.com",
            password="TestPassword123"
        )

        UserProfile.objects.create(
            user=self.user,
            role="resident",
            phone_number="9876501234"
        )

    def test_root_url_redirects_unauthenticated_to_login(self):
        response = self.client.get("/")
        self.assertRedirects(response, reverse("login"))

    def test_root_url_redirects_authenticated_to_dashboard(self):
        self.client.force_login(self.user)
        response = self.client.get("/")
        self.assertRedirects(response, reverse("dashboard"))

    def test_login_page_loads(self):
        response = self.client.get(reverse("login"))
        self.assertEqual(response.status_code, 200)

    def test_registration_page_loads(self):
        response = self.client.get(reverse("register"))
        self.assertEqual(response.status_code, 200)

    def test_dashboard_requires_login(self):
        response = self.client.get(reverse("dashboard"))
        self.assertRedirects(
            response,
            f"{reverse('login')}?next={reverse('dashboard')}"
        )

    def test_valid_login(self):
        response = self.client.post(
            reverse("login"),
            {
                "username": "testresident",
                "password": "TestPassword123",
            }
        )

        self.assertRedirects(response, reverse("dashboard"))
        self.assertTrue(
            "_auth_user_id" in self.client.session
        )

    def test_invalid_login(self):
        response = self.client.post(
            reverse("login"),
            {
                "username": "testresident",
                "password": "WrongPassword123",
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            "_auth_user_id" in self.client.session
        )

    def test_registration_creates_resident(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newresident",
                "email": "newresident@example.com",
                "phone_number": "9876501235",
                "password": "NewPassword123",
                "confirm_password": "NewPassword123",
                "role": "resident",
            }
        )

        self.assertRedirects(response, reverse("login"))

        new_user = User.objects.get(username="newresident")
        self.assertTrue(
            new_user.check_password("NewPassword123")
        )
        self.assertEqual(new_user.profile.role, "resident")
        self.assertEqual(
            new_user.profile.phone_number, "9876501235"
        )

    def test_registration_rejects_non_resident_role(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newguardian",
                "email": "guardian@example.com",
                "phone_number": "9876501236",
                "password": "NewPassword123",
                "confirm_password": "NewPassword123",
                "role": "guardian",
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            User.objects.filter(username="newguardian").exists()
        )

    def test_logout_requires_post(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("logout"))

        self.assertRedirects(response, reverse("dashboard"))
        self.assertTrue(
            "_auth_user_id" in self.client.session
        )

    def test_logout_post_logs_user_out(self):
        self.client.force_login(self.user)

        response = self.client.post(reverse("logout"))

        self.assertRedirects(response, reverse("login"))
        self.assertFalse(
            "_auth_user_id" in self.client.session
        )


class JsonAuthApiTests(TestCase):

    def api_headers_for(self, user):
        session = SessionStore()
        session[SESSION_KEY] = str(user.pk)
        session[BACKEND_SESSION_KEY] = settings.AUTHENTICATION_BACKENDS[0]
        session[HASH_SESSION_KEY] = user.get_session_auth_hash()
        session.set_expiry(12 * 60 * 60)
        session.create()
        return {"HTTP_AUTHORIZATION": f"Bearer {session.session_key}"}

    def registration_payload(self, **overrides):
        payload = {
            "username": "apiresident",
            "email": "apiresident@example.com",
            "phone_number": "9876501299",
            "password": "NewPassword123",
            "confirm_password": "NewPassword123",
        }
        payload.update(overrides)
        return payload

    def test_registration_creates_resident_and_returns_tab_scoped_session(self):
        response = self.client.post(
            "/api/auth/register/",
            data=self.registration_payload(),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        result = response.json()
        self.assertTrue(result["token"])
        self.assertEqual(result["user"]["role"], "RESIDENT")
        self.assertNotIn("_auth_user_id", self.client.session)
        current_user = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {result['token']}",
        )
        self.assertEqual(current_user.status_code, 200)
        self.assertEqual(current_user.json()["id"], result["user"]["id"])
        self.assertEqual(
            User.objects.get(username="apiresident").profile.phone_number,
            "9876501299",
        )
        self.assertTrue(
            User.objects.get(username="apiresident").check_password(
                "NewPassword123"
            )
        )

    def test_registration_does_not_replace_an_authenticated_account(self):
        admin = User.objects.create_superuser(
            username="existing_admin",
            email="existing_admin@example.com",
            password="AdminPassword123",
        )
        self.client.force_login(admin)

        response = self.client.post(
            "/api/auth/register/",
            data=self.registration_payload(),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username="apiresident").exists())
        self.assertEqual(self.client.session["_auth_user_id"], str(admin.pk))
        token = response.json()["token"]
        self.assertEqual(
            self.client.get(
                "/api/auth/me/",
                HTTP_AUTHORIZATION=f"Bearer {token}",
            ).json()["id"],
            response.json()["user"]["id"],
        )
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_separate_role_sessions_remain_isolated_across_refreshes(self):
        accounts = []
        for index, (role, expected_role) in enumerate((
            ("resident", "RESIDENT"),
            ("guardian", "GUARDIAN"),
            ("security", "SECURITY"),
            ("volunteer", "VOLUNTEER"),
        )):
            user = User.objects.create_user(
                username=f"session_{role}",
                email=f"session_{role}@example.com",
                password="AccountPassword123",
            )
            UserProfile.objects.create(
                user=user,
                role=role,
                phone_number=f"98765013{index:02d}",
            )
            accounts.append((user, expected_role))
        admin = User.objects.create_superuser(
            username="session_admin",
            email="session_admin@example.com",
            password="AccountPassword123",
        )
        accounts.append((admin, "ADMIN"))

        clients = []
        for user, expected_role in accounts:
            client = Client()
            login_response = client.post(
                "/api/auth/login/",
                data={
                    "identifier": user.username,
                    "password": "AccountPassword123",
                },
                content_type="application/json",
            )
            self.assertEqual(login_response.status_code, 200)
            self.assertEqual(login_response.json()["user"]["role"], expected_role)
            clients.append((client, user, expected_role, login_response.json()["token"]))

        for client, user, expected_role, token in clients:
            for _ in range(2):
                response = client.get(
                    "/api/auth/me/",
                    HTTP_AUTHORIZATION=f"Bearer {token}",
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["id"], str(user.pk))
                self.assertEqual(response.json()["role"], expected_role)

        guardian_client, _, _, guardian_token = clients[1]
        logout_response = guardian_client.post(
            "/api/auth/logout/",
            HTTP_AUTHORIZATION=f"Bearer {guardian_token}",
        )
        self.assertEqual(logout_response.status_code, 200)
        self.assertEqual(
            guardian_client.get(
                "/api/auth/me/",
                HTTP_AUTHORIZATION=f"Bearer {guardian_token}",
            ).status_code,
            401,
        )

        resident_login = guardian_client.post(
            "/api/auth/login/",
            data={
                "identifier": clients[0][1].username,
                "password": "AccountPassword123",
            },
            content_type="application/json",
        )
        self.assertEqual(resident_login.status_code, 200)
        self.assertEqual(
            guardian_client.get(
                "/api/auth/me/",
                HTTP_AUTHORIZATION=f"Bearer {resident_login.json()['token']}",
            ).json()["id"],
            str(clients[0][1].pk),
        )
        self.assertEqual(
            clients[0][0].get(
                "/api/auth/me/",
                HTTP_AUTHORIZATION=f"Bearer {clients[0][3]}",
            ).json()["id"],
            str(clients[0][1].pk),
        )
        self.assertEqual(
            clients[-1][0].get(
                "/api/auth/me/",
                HTTP_AUTHORIZATION=f"Bearer {clients[-1][3]}",
            ).json()["id"],
            str(admin.pk),
        )

    def test_resident_complaint_does_not_change_separate_admin_session(self):
        admin = User.objects.create_superuser(
            username="isolated_admin",
            email="isolated_admin@example.com",
            password="AccountPassword123",
        )
        resident = User.objects.create_user(
            username="isolated_resident",
            email="isolated_resident@example.com",
            password="AccountPassword123",
        )
        UserProfile.objects.create(
            user=resident,
            role="resident",
            phone_number="9876501400",
        )
        admin_client = Client()
        resident_client = Client()
        tokens = {}
        for client, user in (
            (admin_client, admin),
            (resident_client, resident),
        ):
            login_response = client.post(
                "/api/auth/login/",
                data={
                    "identifier": user.username,
                    "password": "AccountPassword123",
                },
                content_type="application/json",
            )
            self.assertEqual(login_response.status_code, 200)
            tokens[user.pk] = login_response.json()["token"]

        complaint_response = resident_client.post(
            "/reports/api/reports/",
            data={
                "title": "Resident report",
                "incident_type": "OTHER",
                "location": "North entrance",
                "description": "Broken gate latch.",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {tokens[resident.pk]}",
        )

        self.assertEqual(complaint_response.status_code, 201)
        self.assertEqual(complaint_response.json()["reporter"], resident.pk)
        admin_identity = admin_client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {tokens[admin.pk]}",
        )
        self.assertEqual(admin_identity.status_code, 200)
        self.assertEqual(admin_identity.json()["id"], str(admin.pk))
        self.assertEqual(admin_identity.json()["role"], "ADMIN")

    def test_bearer_user_takes_precedence_over_an_existing_cookie_session(self):
        admin = User.objects.create_superuser(
            username="cookie_admin",
            email="cookie_admin@example.com",
            password="TemporaryPassword123!",
        )
        resident = User.objects.create_user(
            username="bearer_resident",
            email="bearer_resident@example.com",
            password="TemporaryPassword123!",
        )
        UserProfile.objects.create(
            user=resident,
            role="resident",
            phone_number="9876501401",
        )
        self.client.force_login(admin)

        response = self.client.post(
            "/reports/api/reports/",
            data={
                "title": "Broken gate",
                "incident_type": "OTHER",
                "location": "North entrance",
                "description": "Broken gate latch.",
            },
            content_type="application/json",
            **self.api_headers_for(resident),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["reporter"], resident.pk)
        self.assertEqual(self.client.session["_auth_user_id"], str(admin.pk))

    def test_api_ignores_frontend_identity_header_and_uses_authenticated_user(self):
        admin = User.objects.create_superuser(
            username="guard_admin",
            email="guard_admin@example.com",
            password="AccountPassword123",
        )
        resident = User.objects.create_user(
            username="guard_resident",
            email="guard_resident@example.com",
            password="AccountPassword123",
        )
        self.client.force_login(resident)

        response = self.client.post(
            "/reports/api/reports/",
            data={
                "title": "Broken gate",
                "incident_type": "OTHER",
                "location": "Community entrance",
                "description": "Broken gate.",
            },
            content_type="application/json",
            HTTP_X_CERP_SESSION_USER=str(admin.pk),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["reporter"], resident.pk)

    def test_registration_cannot_assign_an_elevated_role(self):
        response = self.client.post(
            "/api/auth/register/",
            data=self.registration_payload(role="security"),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["user"]["role"], "RESIDENT")
        self.assertEqual(User.objects.get(username="apiresident").profile.role, "resident")

    def test_registration_rejects_case_insensitive_duplicate_username(self):
        User.objects.create_user(
            username="ExistingResident",
            email="existing@example.com",
            password="ExistingPassword123",
        )

        response = self.client.post(
            "/api/auth/register/",
            data=self.registration_payload(username="existingresident"),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "USERNAME_TAKEN")

    def test_registration_rejects_duplicate_email_and_phone(self):
        User.objects.create_user(
            username="existing_email",
            email="APIRESIDENT@example.com",
            password="ExistingPassword123",
        )

        duplicate_email = self.client.post(
            "/api/auth/register/",
            data=self.registration_payload(),
            content_type="application/json",
        )
        self.assertEqual(duplicate_email.status_code, 400)
        self.assertEqual(duplicate_email.json()["code"], "EMAIL_TAKEN")

        UserProfile.objects.create(
            user=User.objects.create_user(
                username="existing_phone",
                email="phone@example.com",
                password="ExistingPassword123",
            ),
            role="resident",
            phone_number="9876501299",
        )
        duplicate_phone = self.client.post(
            "/api/auth/register/",
            data=self.registration_payload(email="another@example.com"),
            content_type="application/json",
        )
        self.assertEqual(duplicate_phone.status_code, 400)
        self.assertEqual(duplicate_phone.json()["code"], "PHONE_TAKEN")

    def test_registration_rejects_passwords_that_fail_django_validation(self):
        response = self.client.post(
            "/api/auth/register/",
            data=self.registration_payload(
                password="apiresident",
                confirm_password="apiresident",
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "WEAK_PASSWORD")
        self.assertFalse(User.objects.filter(username="apiresident").exists())

    def test_registration_rejects_mismatched_confirmation(self):
        response = self.client.post(
            "/api/auth/register/",
            data=self.registration_payload(confirm_password="DifferentPassword123"),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "PASSWORD_MISMATCH")

    def test_registration_rejects_username_with_invalid_characters(self):
        response = self.client.post(
            "/api/auth/register/",
            data=self.registration_payload(username="invalid username"),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "INVALID_USERNAME")
        self.assertFalse(User.objects.filter(username="invalid username").exists())

    def test_login_accepts_email_and_returns_current_session(self):
        user = User.objects.create_user(
            username="emailresident",
            email="emailresident@example.com",
            password="TestPassword123",
        )
        UserProfile.objects.create(
            user=user,
            role="resident",
            phone_number="9876501288",
        )

        response = self.client.post(
            "/api/auth/login/",
            data={
                "identifier": "emailresident@example.com",
                "password": "TestPassword123",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["id"], str(user.pk))
        token = response.json()["token"]
        current_user = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(current_user.status_code, 200)
        self.assertEqual(current_user.json()["email"], "emailresident@example.com")

        logout_response = self.client.post(
            "/api/auth/logout/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(logout_response.status_code, 200)
        self.assertEqual(
            self.client.get(
                "/api/auth/me/",
                HTTP_AUTHORIZATION=f"Bearer {token}",
            ).status_code,
            401,
        )

    def test_current_user_returns_account_role_and_profile_without_cross_user_data(self):
        for index, (role, expected_role) in enumerate((
            ("resident", "RESIDENT"),
            ("guardian", "GUARDIAN"),
            ("security", "SECURITY"),
            ("volunteer", "VOLUNTEER"),
        )):
            user = User.objects.create_user(
                username=f"role_{role}",
                email=f"{role}@example.com",
                password="StrongPassword123",
            )
            UserProfile.objects.create(
                user=user,
                role=role,
                phone_number=f"98765012{index:02d}",
            )
            response = self.client.get(
                "/api/auth/me/",
                **self.api_headers_for(user),
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["id"], str(user.pk))
            self.assertEqual(response.json()["role"], expected_role)
            self.assertEqual(response.json()["email"], user.email)
            self.assertEqual(response.json()["flat"], "Not assigned")
            self.assertEqual(response.json()["society"], "Not assigned")
            self.assertFalse(response.json()["is_verified"])

        admin = User.objects.create_superuser(
            username="role_admin",
            email="admin@example.com",
            password="StrongPassword123",
        )
        admin_response = self.client.get(
            "/api/auth/me/",
            **self.api_headers_for(admin),
        )

        self.assertEqual(admin_response.status_code, 200)
        self.assertEqual(admin_response.json()["id"], str(admin.pk))
        self.assertEqual(admin_response.json()["role"], "ADMIN")
        self.assertTrue(admin_response.json()["is_verified"])

    def test_current_user_reads_assigned_flat_and_society_from_database(self):
        user = User.objects.create_user(
            username="assigned_resident",
            email="assigned@example.com",
            password="StrongPassword123",
        )
        UserProfile.objects.create(
            user=user,
            role="resident",
            phone_number="9876501298",
        )
        society = Society.objects.create(
            name="Riverside Community",
            address="12 Example Road",
            city="Bengaluru",
            pincode="560001",
        )
        block = Block.objects.create(society=society, name="C")
        flat = Flat.objects.create(block=block, flat_number="205", floor_number=2)
        flat.residents.add(user)
        response = self.client.get(
            "/api/auth/me/",
            **self.api_headers_for(user),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["flat"], "C-205")
        self.assertEqual(response.json()["society"], "Riverside Community")

    def test_login_accepts_case_insensitive_username(self):
        user = User.objects.create_user(
            username="CaseSensitiveResident",
            email="case@example.com",
            password="StrongPassword123",
        )

        response = self.client.post(
            "/api/auth/login/",
            data={
                "identifier": "casesensitiveresident",
                "password": "StrongPassword123",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["id"], str(user.pk))

    def test_login_rejects_incorrect_password_without_authenticating(self):
        User.objects.create_user(
            username="wrong_password_resident",
            password="CorrectPassword123",
        )

        response = self.client.post(
            "/api/auth/login/",
            data={
                "identifier": "wrong_password_resident",
                "password": "IncorrectPassword123",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "INVALID_CREDENTIALS")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_csrf_endpoint_sets_cookie(self):
        response = self.client.get("/api/auth/csrf/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)

    def test_authentication_write_endpoints_require_csrf(self):
        csrf_enforcing_client = Client(enforce_csrf_checks=True)

        response = csrf_enforcing_client.post(
            "/api/auth/register/",
            data=self.registration_payload(),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username="apiresident").exists())


class VolunteerAdminManagementTests(TestCase):
    def test_staff_admin_can_view_create_and_edit_volunteer_profiles(self):
        admin = User.objects.create_superuser(
            username="volunteer_admin",
            email="volunteer-admin@example.com",
            password="AdminPassword123",
        )
        volunteer = User.objects.create_user(
            username="managed_volunteer",
            email="managed-volunteer@example.com",
            password="VolunteerPassword123",
        )
        new_volunteer = User.objects.create_user(
            username="new_admin_volunteer",
            email="new-admin-volunteer@example.com",
            password="VolunteerPassword123",
        )
        profile = UserProfile.objects.create(
            user=volunteer,
            role="volunteer",
            phone_number="9876501402",
            is_verified=False,
        )
        self.client.force_login(admin)

        list_response = self.client.get(
            reverse("admin:users_userprofile_changelist")
        )
        add_response = self.client.get(
            reverse("admin:users_userprofile_add")
        )
        user_add_response = self.client.get(reverse("admin:auth_user_add"))
        create_response = self.client.post(
            reverse("admin:users_userprofile_add"),
            {
                "user": new_volunteer.pk,
                "role": "volunteer",
                "phone_number": "9876501403",
                "is_verified": "on",
                "_save": "Save",
            },
        )
        edit_response = self.client.get(
            reverse("admin:users_userprofile_change", args=[profile.pk])
        )
        update_response = self.client.post(
            reverse("admin:users_userprofile_change", args=[profile.pk]),
            {
                "user": volunteer.pk,
                "role": "volunteer",
                "phone_number": profile.phone_number,
                "is_verified": "on",
                "_save": "Save",
            },
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertContains(list_response, volunteer.username)
        self.assertEqual(add_response.status_code, 200)
        self.assertEqual(user_add_response.status_code, 200)
        self.assertEqual(create_response.status_code, 302)
        self.assertEqual(edit_response.status_code, 200)
        self.assertEqual(update_response.status_code, 302)
        created_profile = UserProfile.objects.get(user=new_volunteer)
        self.assertEqual(created_profile.role, "volunteer")
        self.assertTrue(created_profile.is_verified)
        profile.refresh_from_db()
        self.assertEqual(profile.role, "volunteer")
        self.assertTrue(profile.is_verified)
