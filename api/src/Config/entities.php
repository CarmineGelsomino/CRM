<?php

declare(strict_types=1);

return [
    'users' => [
        'table' => 'users',
        'fields' => ['first_name', 'last_name', 'email', 'password_hash', 'is_active'],
    ],
    'contacts' => [
        'table' => 'contacts',
        'fields' => ['user_id', 'first_name', 'last_name', 'email', 'pec_email', 'category', 'status', 'generic_info'],
    ],
    'contact_phones' => [
        'table' => 'contact_phones',
        'fields' => ['contact_id', 'phone', 'is_primary', 'note'],
    ],
    'contact_addresses' => [
        'table' => 'contact_addresses',
        'fields' => ['contact_id', 'address_line', 'city', 'postal_code', 'province', 'country', 'is_primary', 'note'],
    ],
    'buyer_profiles' => [
        'table' => 'buyer_profiles',
        'fields' => ['contact_id', 'requested_area', 'property_type', 'floor_preference', 'purchase_price_renovated', 'purchase_price_to_renovate', 'mortgage_type', 'mortgage_other'],
    ],
    'buyer_preferences' => [
        'table' => 'buyer_preferences',
        'fields' => ['buyer_profile_id', 'preference_type', 'other_value'],
    ],
    'notes' => [
        'table' => 'notes',
        'fields' => ['user_id', 'contact_id', 'message'],
    ],
    'activities' => [
        'table' => 'activities',
        'fields' => ['user_id', 'contact_id', 'activity_type', 'title', 'description', 'reminder_at', 'notify_web', 'notify_email', 'sync_calendar', 'priority', 'status', 'completed_at'],
    ],
    'properties' => [
        'table' => 'properties',
        'fields' => ['user_id', 'address_line', 'city', 'postal_code', 'province', 'country', 'subalterno', 'apartment_floor', 'internal_sqm', 'external_sqm', 'other_info', 'description', 'property_condition', 'listing_url', 'owner_home_address', 'work_contact', 'first_av', 'administrator'],
    ],
    'property_features' => [
        'table' => 'property_features',
        'fields' => ['property_id', 'feature_type'],
    ],
    'property_owners' => [
        'table' => 'property_owners',
        'fields' => ['property_id', 'contact_id', 'is_primary_owner'],
    ],
    'property_asking_prices' => [
        'table' => 'property_asking_prices',
        'fields' => ['property_id', 'price', 'effective_date', 'note'],
    ],
    'property_valuations' => [
        'table' => 'property_valuations',
        'fields' => ['property_id', 'valuation_price', 'valuation_date', 'note'],
    ],
    'settings' => [
        'table' => 'settings',
        'fields' => ['user_id', 'inactive_contact_alert_days', 'email_notifications_enabled', 'webpush_notifications_enabled', 'calendar_sync_enabled'],
    ],
    'push_subscriptions' => [
        'table' => 'push_subscriptions',
        'fields' => ['user_id', 'endpoint', 'p256dh', 'auth', 'user_agent', 'is_active'],
    ],
    'templates' => [
        'table' => 'templates',
        'fields' => ['user_id', 'name', 'subject', 'body'],
    ],
    'communications' => [
        'table' => 'communications',
        'fields' => ['user_id', 'contact_id', 'template_id', 'communication_type', 'subject', 'message', 'status', 'scheduled_at', 'sent_at', 'external_message_id', 'error_message'],
    ],
    'communication_logs' => [
        'table' => 'communication_logs',
        'fields' => ['communication_id', 'log_type', 'message'],
    ],
];
