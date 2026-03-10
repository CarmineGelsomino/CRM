-- =========================================================
-- CRM TRADE IMMOBILIARE
-- Schema database MySQL 8+
-- Engine: InnoDB
-- Charset: utf8mb4
-- FILE ELENCO ISTRUZIONI UTILIZZATE PER CREARE IL DATABASE
-- =========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- DROP TABLES (ordine inverso dipendenze)
-- =========================================================

DROP TABLE IF EXISTS communication_logs;
DROP TABLE IF EXISTS communications;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS property_valuations;
DROP TABLE IF EXISTS property_asking_prices;
DROP TABLE IF EXISTS property_features;
DROP TABLE IF EXISTS property_owners;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS buyer_preferences;
DROP TABLE IF EXISTS buyer_profiles;
DROP TABLE IF EXISTS contact_addresses;
DROP TABLE IF EXISTS contact_phones;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- CONTACTS
-- =========================================================

CREATE TABLE contacts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    email VARCHAR(190) NULL,
    pec_email VARCHAR(190) NULL,

    category ENUM('venditore','acquirente','segnalatore','cerchia_personale') NOT NULL,
    status ENUM('attivo','archiviato','futuro') NOT NULL DEFAULT 'attivo',

    generic_info TEXT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_contacts_user_id (user_id),
    KEY idx_contacts_category (category),
    KEY idx_contacts_status (status),
    KEY idx_contacts_created_at (created_at),
    KEY idx_contacts_updated_at (updated_at),
    KEY idx_contacts_name (last_name, first_name),

    CONSTRAINT fk_contacts_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- CONTACT PHONES (1..N)
-- =========================================================

CREATE TABLE contact_phones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contact_id BIGINT UNSIGNED NOT NULL,
    phone VARCHAR(50) NOT NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    note VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_contact_phones_contact_id (contact_id),
    KEY idx_contact_phones_phone (phone),

    CONSTRAINT fk_contact_phones_contact
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- CONTACT ADDRESSES (1..N)
-- =========================================================

CREATE TABLE contact_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contact_id BIGINT UNSIGNED NOT NULL,

    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(100) NULL,
    postal_code VARCHAR(20) NULL,
    province VARCHAR(100) NULL,
    country VARCHAR(100) NULL DEFAULT 'Italia',

    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    note VARCHAR(255) NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_contact_addresses_contact_id (contact_id),
    KEY idx_contact_addresses_city (city),
    KEY idx_contact_addresses_postal_code (postal_code),

    CONSTRAINT fk_contact_addresses_contact
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- BUYER PROFILE
-- solo per contatti categoria = acquirente
-- =========================================================

CREATE TABLE buyer_profiles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contact_id BIGINT UNSIGNED NOT NULL,

    requested_area VARCHAR(255) NULL,
    property_type VARCHAR(100) NULL,

    floor_preference ENUM('basso','intermedio','ultimo','indifferente') NOT NULL DEFAULT 'indifferente',

    purchase_price_renovated DECIMAL(12,2) NULL,
    purchase_price_to_renovate DECIMAL(12,2) NULL,

    mortgage_type ENUM('no','50','100','altro') NOT NULL DEFAULT 'no',
    mortgage_other TEXT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_buyer_profiles_contact_id (contact_id),
    KEY idx_buyer_profiles_floor_preference (floor_preference),

    CONSTRAINT fk_buyer_profiles_contact
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- BUYER PREFERENCES (checkbox multiple)
-- =========================================================

CREATE TABLE buyer_preferences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    buyer_profile_id BIGINT UNSIGNED NOT NULL,
    preference_type ENUM('box','posto_auto','cantina','terrazzo','altro') NOT NULL,
    other_value VARCHAR(255) NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uk_buyer_pref_unique (buyer_profile_id, preference_type, other_value),
    KEY idx_buyer_preferences_profile_id (buyer_profile_id),

    CONSTRAINT fk_buyer_preferences_profile
        FOREIGN KEY (buyer_profile_id) REFERENCES buyer_profiles(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- NOTES
-- Le note sono collegate al contatto
-- =========================================================

CREATE TABLE notes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,

    message TEXT NOT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_notes_user_id (user_id),
    KEY idx_notes_contact_id (contact_id),
    KEY idx_notes_created_at (created_at),

    CONSTRAINT fk_notes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_notes_contact
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- ACTIVITIES
-- Le attività sono collegate al contatto
-- =========================================================

CREATE TABLE activities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,

    activity_type ENUM('chiamata','messaggio','email','evento','altro') NOT NULL,
    title VARCHAR(255) NULL,
    description TEXT NULL,

    reminder_at DATETIME NULL,

    notify_web TINYINT(1) NOT NULL DEFAULT 1,
    notify_email TINYINT(1) NOT NULL DEFAULT 0,
    sync_calendar TINYINT(1) NOT NULL DEFAULT 0,

    priority ENUM('bassa','media','alta') NOT NULL DEFAULT 'media',
    status ENUM('da_fare','completato','sospeso','annullato') NOT NULL DEFAULT 'da_fare',

    completed_at DATETIME NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_activities_user_id (user_id),
    KEY idx_activities_contact_id (contact_id),
    KEY idx_activities_reminder_at (reminder_at),
    KEY idx_activities_status (status),
    KEY idx_activities_priority (priority),
    KEY idx_activities_type (activity_type),
    KEY idx_activities_created_at (created_at),

    CONSTRAINT fk_activities_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_activities_contact
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- PROPERTIES
-- =========================================================

CREATE TABLE properties (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(100) NULL,
    postal_code VARCHAR(20) NULL,
    province VARCHAR(100) NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Italia',

    subalterno VARCHAR(100) NULL,

    apartment_floor VARCHAR(50) NULL,

    internal_sqm DECIMAL(10,2) NULL,
    external_sqm DECIMAL(10,2) NULL,

    other_info TEXT NULL,
    description TEXT NULL,

    property_condition ENUM('da_ristrutturare','ristrutturato','nuovo') NULL,

    listing_url VARCHAR(500) NULL,

    owner_home_address VARCHAR(255) NULL,
    work_contact VARCHAR(255) NULL,

    first_av VARCHAR(255) NULL,
    administrator VARCHAR(255) NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_properties_user_id (user_id),
    KEY idx_properties_city (city),
    KEY idx_properties_postal_code (postal_code),
    KEY idx_properties_condition (property_condition),
    KEY idx_properties_created_at (created_at),
    KEY idx_properties_updated_at (updated_at),
    KEY idx_properties_address (address_line),

    CONSTRAINT fk_properties_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- PROPERTY FEATURES
-- =========================================================

CREATE TABLE property_features (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    property_id BIGINT UNSIGNED NOT NULL,
    feature_type ENUM('ascensore','posto_auto','box','cantina','terrazzo','giardino') NOT NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uk_property_feature_unique (property_id, feature_type),
    KEY idx_property_features_property_id (property_id),

    CONSTRAINT fk_property_features_property
        FOREIGN KEY (property_id) REFERENCES properties(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- PROPERTY OWNERS
-- N:N tra immobili e contatti
-- idealmente solo contatti categoria venditore, ma questo
-- vincolo lo controlli lato applicazione
-- =========================================================

CREATE TABLE property_owners (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    property_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    is_primary_owner TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_property_owner_unique (property_id, contact_id),
    KEY idx_property_owners_property_id (property_id),
    KEY idx_property_owners_contact_id (contact_id),

    CONSTRAINT fk_property_owners_property
        FOREIGN KEY (property_id) REFERENCES properties(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_property_owners_contact
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- PROPERTY ASKING PRICES (storico prezzi richiesta)
-- =========================================================

CREATE TABLE property_asking_prices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    property_id BIGINT UNSIGNED NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    effective_date DATE NOT NULL,
    note VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_property_asking_prices_property_id (property_id),
    KEY idx_property_asking_prices_effective_date (effective_date),

    CONSTRAINT fk_property_asking_prices_property
        FOREIGN KEY (property_id) REFERENCES properties(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- PROPERTY VALUATIONS
-- =========================================================

CREATE TABLE property_valuations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    property_id BIGINT UNSIGNED NOT NULL,
    valuation_price DECIMAL(12,2) NOT NULL,
    valuation_date DATE NOT NULL,
    note VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_property_valuations_property_id (property_id),
    KEY idx_property_valuations_valuation_date (valuation_date),

    CONSTRAINT fk_property_valuations_property
        FOREIGN KEY (property_id) REFERENCES properties(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- SETTINGS
-- parametri applicativi per utente
-- =========================================================

CREATE TABLE settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    inactive_contact_alert_days INT UNSIGNED NOT NULL DEFAULT 30,
    email_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
    webpush_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
    calendar_sync_enabled TINYINT(1) NOT NULL DEFAULT 0,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_settings_user_id (user_id),

    CONSTRAINT fk_settings_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- PUSH SUBSCRIPTIONS
-- =========================================================

CREATE TABLE push_subscriptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,

    user_agent VARCHAR(255) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_push_subscriptions_user_id (user_id),
    KEY idx_push_subscriptions_is_active (is_active),

    CONSTRAINT fk_push_subscriptions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- TEMPLATES
-- =========================================================

CREATE TABLE templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(150) NOT NULL,
    subject VARCHAR(255) NULL,
    body TEXT NOT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_templates_user_id (user_id),
    KEY idx_templates_name (name),

    CONSTRAINT fk_templates_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- COMMUNICATIONS
-- =========================================================

CREATE TABLE communications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    template_id BIGINT UNSIGNED NULL,

    communication_type ENUM('email') NOT NULL DEFAULT 'email',
    subject VARCHAR(255) NULL,
    message TEXT NOT NULL,

    status ENUM('bozza','programmata','inviata','fallita') NOT NULL DEFAULT 'bozza',

    scheduled_at DATETIME NULL,
    sent_at DATETIME NULL,
    external_message_id VARCHAR(255) NULL,
    error_message TEXT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_communications_user_id (user_id),
    KEY idx_communications_contact_id (contact_id),
    KEY idx_communications_template_id (template_id),
    KEY idx_communications_status (status),
    KEY idx_communications_scheduled_at (scheduled_at),
    KEY idx_communications_sent_at (sent_at),

    CONSTRAINT fk_communications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_communications_contact
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_communications_template
        FOREIGN KEY (template_id) REFERENCES templates(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- COMMUNICATION LOGS
-- utile per tracciare retry, provider response, eventi
-- =========================================================

CREATE TABLE communication_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    communication_id BIGINT UNSIGNED NOT NULL,
    log_type ENUM('info','warning','error','provider_response') NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_communication_logs_communication_id (communication_id),
    KEY idx_communication_logs_created_at (created_at),

    CONSTRAINT fk_communication_logs_communication
        FOREIGN KEY (communication_id) REFERENCES communications(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- DATI BASE OPZIONALI
-- =========================================================

INSERT INTO users (first_name, last_name, email, password_hash)
VALUES
('Utente', 'Demo 1', 'demo1@example.com', '$2y$10$replace_with_real_hash'),
('Utente', 'Demo 2', 'demo2@example.com', '$2y$10$replace_with_real_hash');

INSERT INTO settings (user_id, inactive_contact_alert_days, email_notifications_enabled, webpush_notifications_enabled, calendar_sync_enabled)
VALUES
(1, 30, 1, 1, 0),
(2, 30, 1, 1, 0);