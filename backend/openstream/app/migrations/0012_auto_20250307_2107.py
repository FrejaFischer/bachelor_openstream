# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-License-Identifier: AGPL-3.0-only
from django.db import migrations


def create_api_keys(apps, schema_editor):
    Branch = apps.get_model("app", "Branch")
    APIKey = apps.get_model("app", "SlideshowPlayerAPIKey")
    for branch in Branch.objects.all():
        if not APIKey.objects.filter(branch=branch).exists():
            APIKey.objects.create(branch=branch)


def reverse_func(apps, schema_editor):
    APIKey = apps.get_model("app", "SlideshowPlayerAPIKey")
    APIKey.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0011_alter_slideshowplayerapikey_user"),
    ]

    operations = [
        # Remove the old user field so it no longer imposes a non-null constraint.
        migrations.RemoveField(
            model_name="slideshowplayerapikey",
            name="user",
        ),
        # Now create API keys for existing Branch instances.
        migrations.RunPython(create_api_keys, reverse_func),
    ]
