# Crazy Hiker - Feature Report

This document describes all features of the Crazy Hiker hiking club management platform.

---

## Table of Contents

1. [Public Features](#1-public-features)
2. [Member Features](#2-member-features)
3. [Manager Features](#3-manager-features)
4. [Admin Features](#4-admin-features)
5. [Automated Features](#5-automated-features)
6. [Configurable Settings](#6-configurable-settings)
7. [Multi-Language Support](#7-multi-language-support)

---

## 1. Public Features

These features are available without logging in.

### Activity Browsing
- View list of upcoming activities with open registration
- See activity details: title, description, date, deadline, capacity, available spots
- View cover images and assigned managers/co-managers
- Full activities (reached max registration) are automatically hidden from the list

### Account Creation
- Sign up with name and email
- Sign in via magic link (a login link sent to your email, no password needed)
- Sessions last 30 days (no need to re-login frequently)

---

## 2. Member Features

Available after signing in with a member account.

### Dashboard
- View count of upcoming confirmed activities
- Check waiver status at a glance

### Activity Registration
- Register for open activities before the registration deadline
- Email and name are pre-filled from your account
- Add optional notes when registering
- **Same-day check**: Cannot register for two activities on the same date
- **Waiver required**: Must have an approved waiver before registering
- View your registration status: Pending / Confirmed
- Withdraw a pending registration before the deadline
- Confirmed registrations cannot be self-withdrawn (contact the activity manager)

### My Activities
- View all activities you've registered for
- Organized into "Upcoming" and "Past" sections
- Click any activity to see its details

### Waiver Management
- Download the official waiver template PDF
- Upload your signed waiver (PDF, JPG, or PNG)
- Track waiver status: Pending Approval / Approved / Rejected / Expiring / Expired
- Receive email notification 7 days before your waiver expires
- Waivers are valid for 1 year (configurable by admin)

### Profile
- View and edit your name
- View your role and email

### Promotion to Intern Manager
- Apply once you meet the requirements:
  - At least 3 attended activities (configurable)
  - Activities with at least 2 different main managers (configurable)
  - No active flags/bans on your account
- Submit an application with self-introduction text
- Select 2 non-intern managers as referrals (configurable)
- Referral managers receive an email to approve or reject
- Both referrals must approve, then an admin reviews and finalizes
- You're notified of the result by email

---

## 3. Manager Features

Available to both intern and qualified managers. Managers see everything members see, plus the following.

### Activity Creation
- Create new hiking activities with:
  - Title, description, cover image
  - Activity date and registration deadline
  - Capacity and maximum registration limit
  - Co-manager assignments (with email invitations)
  - Group chat QR code (optional)
- You are automatically assigned as the main manager
- **Intern restriction**: Intern managers must have at least one qualified co-manager

### Activity Management
- View only your own activities (managed or co-managed)
- Edit activity details while the activity is open or closed (title, dates, capacity, etc.)
- Close registration manually before the deadline
- Finish (complete) an activity
- Cancel an activity
- Once completed or cancelled, the activity becomes read-only

### Registration Management (per activity)
- View all registrations for your activities
- Confirm pending registrations (sends confirmation email to the member)
- Mark attendance after the activity
- Mark absences
- Remove registrations
- When confirming a registration, conflicting same-day registrations are automatically cancelled
- **Shadow ban**: Members with active flags appear to register successfully, but their registration is hidden from managers

### Member Conduct & Flags
- Issue yellow or red flags to members from the registration management page
- Yellow flag: 7-day ban from registering (configurable)
- Red flag: 30-day ban (configurable)
- 3 yellow flags automatically escalate to a red flag (configurable threshold)
- Flags expire after 6 months (configurable)
- Add a reason when issuing a flag
- View flag history for any member

### Co-Manager Invitations
- Receive invitations via email when assigned as co-manager
- Accept or decline via a magic link (no login required)
- Invitations are automatically invalidated when the activity is completed or cancelled

### Promotion to Qualified Manager
- Apply once you meet the requirements:
  - At least 2 completed activities as main manager (configurable)
  - At least 2 completed activities as co-manager (configurable)
- All qualified managers receive a vote email
- 24-hour voting window (configurable)
- 2/3 of cast votes must approve (configurable ratio)
- Uncasted votes are ignored (only actual responses count)
- After votes pass, an admin reviews and finalizes
- You're notified of the result by email

### KPI Tracking
- KPI is computed automatically from completed activities:
  - +2 points per main-managed activity (configurable)
  - +1 point per co-managed activity (configurable)
- KPI is tracked per hiking season (November 1 to October 31, configurable)
- **Demotion**: Qualified managers who don't main-manage any activity in a season are demoted to intern
- **Removal**: Intern managers who don't qualify within 2 seasons (configurable) are removed from manager status

---

## 4. Admin Features

Admins see everything managers and members see, plus the following.

### All Activities (Read-Only)
- View every activity on the platform regardless of manager assignment
- See activity status, managers, co-managers, and registration counts
- Click through to activity details with participant lists

### User Management
- View all users on the platform (members, managers, and admins)
- See each user's role, attended activity count, waiver status, and ban status
- Click through to detailed user profiles showing:
  - Basic info (email, role, join date)
  - All waivers (every status, with view links)
  - Complete activity history with attendance status
  - All flags (active and expired, with issuer and reason)

### Waiver Approval
- View all pending waiver submissions
- Approve or reject waivers with one click
- View submitted waiver documents
- When approving a new waiver, previous waivers are automatically marked as expired

### Manager Management
- View all managers and admins with their tags, intern/qualified status, and KPI
- Create new managers by entering an email address
  - If the user exists as a member, they are upgraded to manager
  - If the user doesn't exist, a new manager account is created

### Promotion Review
- Review promotion requests that have passed the voting threshold
- See the requester's name, promotion type, vote results, and application text
- Approve or reject with an optional reason
- On approval, the promotion is executed automatically (role upgrade, profile creation)
- The candidate is notified by email

### System Settings
All thresholds and durations are configurable:

| Setting | Default | Description |
|---------|---------|-------------|
| Yellow flag ban duration | 7 days | How long a yellow flag bans registration |
| Red flag ban duration | 30 days | How long a red flag bans registration |
| Flag expiry period | 180 days | How long flags stay on a user's record |
| Yellow-to-red threshold | 3 | Number of yellow flags that auto-escalate to red |
| Waiver validity period | 365 days | How long an approved waiver lasts |
| Waiver expiry warning | 7 days | How many days before expiry to send a warning email |
| Promotion voting window | 24 hours | How long managers have to vote on promotions |
| Vote approval ratio | 67% | Percentage of votes needed to pass (2/3) |
| Min attended activities (intern application) | 3 | Activities needed to apply for intern manager |
| Min distinct managers (intern application) | 2 | Different main managers needed |
| Min managed activities (qualified application) | 2 | Main-managed activities needed for qualified |
| Min co-managed activities (qualified application) | 2 | Co-managed activities needed for qualified |
| Referral count | 2 | Number of referrals needed for intern application |
| KPI per managed activity | 2 points | Points earned as main manager |
| KPI per co-managed activity | 1 point | Points earned as co-manager |
| Hiking season start month | November (11) | When the hiking season begins |
| Intern max duration | 2 seasons | How long someone can remain an intern |

---

## 5. Automated Features

These run automatically on a schedule without manual intervention.

### Waiver Expiry Check (Daily, 1 AM)
- Marks approved waivers as expired after the validity period
- Sends warning emails 7 days before expiration
- Users with expired waivers cannot register for activities

### Promotion Resolution (Daily, 2 AM)
- Expires promotion requests that have passed the voting window
- Tallies votes for intern-to-qualified promotions:
  - If 2/3 of cast votes approve: moves to admin review
  - If less than 2/3: rejects and notifies the candidate
  - If no votes were cast: marks as expired
- Notifies candidates of results by email

### KPI & Demotion Check (Annually, November 1)
- Checks all qualified managers for season activity completion
- Demotes qualified managers to intern if they didn't main-manage any completed activity in the past season
- Removes intern managers who have exceeded the maximum intern duration without qualifying
- Sends notification emails to affected managers

---

## 6. Configurable Settings

All settings listed in section 4 (System Settings) can be adjusted by admins at any time through the Settings page in the admin dashboard. Changes take effect immediately.

---

## 7. Multi-Language Support

The platform supports two languages:
- **Chinese (Simplified)** - Default language
- **English**

Users can switch between languages using the toggle button in the header. All UI text, labels, form fields, email notifications, and status messages are fully translated.

---

## Role Summary

| Panel | Member | Manager | Admin |
|-------|--------|---------|-------|
| Dashboard (personal stats) | Yes | Yes | Yes |
| My Activities | Yes | Yes | Yes |
| My Waivers | Yes | Yes | Yes |
| My Profile + Promotion | Yes | Yes | Yes |
| Activity Management (own) | - | Yes | Yes |
| Registration Management | - | Yes | Yes |
| Member Flagging | - | Yes | Yes |
| All Activities (read-only) | - | - | Yes |
| User Management | - | - | Yes |
| Waiver Approval | - | - | Yes |
| Manager Creation | - | - | Yes |
| Promotion Review | - | - | Yes |
| System Settings | - | - | Yes |

> Note: Managers can view individual user profiles (for activity screening purposes), but only admins have access to the full user management panel.
