# SPDX-FileCopyrightText: 2025 Freja Fischer Nielsen <https://github.com/FrejaFischer/bachelor_openstream>
# SPDX-License-Identifier: AGPL-3.0-only
from django.shortcuts import get_object_or_404
from app.models import OrganisationMembership, Branch


def user_is_super_admin(user):
    """Check if user has super_admin role"""
    return OrganisationMembership.objects.filter(user=user, role="super_admin").exists()


def get_branch_for_user(user, branch_id):
    """
    Returns the branch after verifying the user is either:
    - org_admin of the branch's org
    - suborg_admin of the branch's suborg
    - branch_admin / employee for that exact branch
    - super_admin.

    ## Exceptions:
    - Raises Http404 exception if branch object is not found.
    - Raises ValueError otherwise.
    """
    if not branch_id:
        raise ValueError("branch_id is required.")

    branch = get_object_or_404(Branch, id=branch_id)

    # super_admin can access everything
    if user_is_super_admin(user):
        return branch

    # org_admin
    if OrganisationMembership.objects.filter(
        user=user,
        organisation=branch.suborganisation.organisation,
        role="org_admin",
    ).exists():
        return branch

    # suborg_admin
    if OrganisationMembership.objects.filter(
        user=user, suborganisation=branch.suborganisation, role="suborg_admin"
    ).exists():
        return branch

    # branch_admin or employee for that branch
    if OrganisationMembership.objects.filter(user=user, branch=branch).exists():
        return branch

    raise ValueError(
        f"User '{user.username}' does not have permission to access branch_id={branch_id}."
    )
