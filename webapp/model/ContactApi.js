sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (MessageBox, MessageToast) {
    "use strict";

    var ENTITY_CONTACTS = "contacts";
    var ENTITY_CONTACT_PHONES = "contact_phones";
    var ENTITY_BUYER_PROFILES = "buyer_profiles";
    var ENTITY_BUYER_PREFERENCES = "buyer_preferences";
    var ENTITY_ACTIVITIES = "activities";
    var ENTITY_NOTES = "notes";

    var CONTACT_FIELDS = [
        "user_id",
        "first_name",
        "last_name",
        "email",
        "pec_email",
        "category",
        "status",
        "generic_info"
    ];

    var ACTIVITY_FIELDS = [
        "user_id",
        "contact_id",
        "activity_type",
        "title",
        "description",
        "reminder_at",
        "notify_web",
        "notify_email",
        "sync_calendar",
        "priority",
        "status",
        "completed_at"
    ];

    var NOTE_FIELDS = [
        "user_id",
        "contact_id",
        "message"
    ];

    var BUYER_PROFILE_FIELDS = [
        "contact_id",
        "requested_area",
        "property_type",
        "floor_preference",
        "purchase_price_renovated",
        "purchase_price_to_renovate",
        "mortgage_type",
        "mortgage_other"
    ];

    var CONTACT_PHONE_FIELDS = [
        "contact_id",
        "phone",
        "is_primary",
        "note"
    ];

    var BUYER_PREFERENCE_FIELDS = [
        "buyer_profile_id",
        "preference_type",
        "other_value"
    ];

    function buildUrl(sEntity, mQuery) {
        var sBaseUrl = window.CRM_CONFIG.apiBaseUrl + "/index.php?entity=" + encodeURIComponent(sEntity);
        var sQuery = buildQuery(mQuery);

        return sQuery ? sBaseUrl + "&" + sQuery : sBaseUrl;
    }

    function buildQuery(mQuery) {
        if (!mQuery) {
            return "";
        }

        return Object.keys(mQuery)
            .filter(function (sKey) {
                return mQuery[sKey] !== undefined && mQuery[sKey] !== null && mQuery[sKey] !== "";
            })
            .map(function (sKey) {
                return encodeURIComponent(sKey) + "=" + encodeURIComponent(String(mQuery[sKey]));
            })
            .join("&");
    }

    function sanitizePayload(oPayload, aAllowedFields) {
        var oSafePayload = {};

        (aAllowedFields || []).forEach(function (sField) {
            if (Object.prototype.hasOwnProperty.call(oPayload || {}, sField)) {
                oSafePayload[sField] = oPayload[sField];
            }
        });

        return oSafePayload;
    }

    async function parseResponse(oResponse) {
        var oData;

        try {
            oData = await oResponse.json();
        } catch (oError) {
            oData = null;
        }

        if (!oResponse.ok || !oData || oData.ok === false) {
            throw {
                status: oResponse.status,
                message: (oData && oData.message) || "Operazione non riuscita. Riprova più tardi.",
                details: oData
            };
        }

        return oData;
    }

    function notifyError(oError, sFallbackMessage, bUseMessageBox) {
        var sMessage = (oError && oError.message) || sFallbackMessage || "Si è verificato un errore imprevisto.";

        if (bUseMessageBox) {
            MessageBox.error(sMessage);
            return;
        }

        MessageToast.show(sMessage);
    }


    function shouldRetryWithoutEnumField(oError) {
        var sMessage = ((oError && oError.message) || "").toLowerCase();
        return sMessage.indexOf("data truncated for column 'category'") !== -1 ||
            sMessage.indexOf('data truncated for column "category"') !== -1 ||
            sMessage.indexOf("data truncated for column 'status'") !== -1 ||
            sMessage.indexOf('data truncated for column "status"') !== -1;
    }

    function removeInvalidEnumFields(oPayload) {
        var oCleanPayload = Object.assign({}, oPayload || {});

        if (oCleanPayload.category === "" || oCleanPayload.category === null || oCleanPayload.category === undefined) {
            delete oCleanPayload.category;
        }

        if (oCleanPayload.status === "" || oCleanPayload.status === null || oCleanPayload.status === undefined) {
            delete oCleanPayload.status;
        }

        return oCleanPayload;
    }

    async function request(oOptions) {
        var sUrl = buildUrl(oOptions.entity, oOptions.query);
        var oFetchOptions = {
            method: oOptions.method || "GET",
            credentials: "same-origin",
            headers: {
                "Accept": "application/json"
            }
        };

        if (oOptions.payload) {
            oFetchOptions.headers["Content-Type"] = "application/json";
            oFetchOptions.body = JSON.stringify(oOptions.payload);
        }

        try {
            var oResponse = await fetch(sUrl, oFetchOptions);
            if (oOptions.allowNotFound && oResponse.status === 404) {
                return null;
            }
            var oResult = await parseResponse(oResponse);
            return oResult.data;
        } catch (oError) {
            notifyError(oError, oOptions.errorMessage, !!oOptions.useMessageBox);
            throw oError;
        }
    }

    function listContacts(mFilters) {
        return request({
            entity: ENTITY_CONTACTS,
            query: mFilters,
            method: "GET",
            errorMessage: "Impossibile caricare i contatti.",
            useMessageBox: false
        });
    }

    function getContact(iId) {
        return request({
            entity: ENTITY_CONTACTS,
            query: { id: iId },
            method: "GET",
            errorMessage: "Contatto non trovato.",
            useMessageBox: true
        });
    }

    async function createContact(oPayload) {
        var oSanitizedPayload = sanitizePayload(oPayload, CONTACT_FIELDS);
        var oSafePayload = removeInvalidEnumFields(oSanitizedPayload);

        try {
            return await request({
                entity: ENTITY_CONTACTS,
                method: "POST",
                payload: oSafePayload,
                errorMessage: "Impossibile creare il contatto.",
                useMessageBox: true
            });
        } catch (oError) {
            if (shouldRetryWithoutEnumField(oError)) {
                delete oSafePayload.category;
                delete oSafePayload.status;

                return request({
                    entity: ENTITY_CONTACTS,
                    method: "POST",
                    payload: oSafePayload,
                    errorMessage: "Impossibile creare il contatto.",
                    useMessageBox: true
                });
            }

            throw oError;
        }
    }

    async function updateContact(iId, oPayload) {
        var oSanitizedPayload = sanitizePayload(oPayload, CONTACT_FIELDS);
        var oSafePayload = removeInvalidEnumFields(oSanitizedPayload);

        try {
            return await request({
                entity: ENTITY_CONTACTS,
                query: { id: iId },
                method: "PUT",
                payload: oSafePayload,
                errorMessage: "Impossibile aggiornare il contatto.",
                useMessageBox: true
            });
        } catch (oError) {
            if (shouldRetryWithoutEnumField(oError)) {
                delete oSafePayload.category;
                delete oSafePayload.status;

                return request({
                    entity: ENTITY_CONTACTS,
                    query: { id: iId },
                    method: "PUT",
                    payload: oSafePayload,
                    errorMessage: "Impossibile aggiornare il contatto.",
                    useMessageBox: true
                });
            }

            throw oError;
        }
    }

    function deleteContact(iId) {
        return request({
            entity: ENTITY_CONTACTS,
            query: { id: iId },
            method: "DELETE",
            errorMessage: "Impossibile eliminare il contatto.",
            useMessageBox: true
        });
    }

    function listContactPhones(iContactId) {
        return request({
            entity: ENTITY_CONTACT_PHONES,
            query: { contact_id: iContactId },
            method: "GET",
            errorMessage: "Impossibile caricare i numeri di telefono.",
            useMessageBox: true
        });
    }

    function createContactPhone(oPayload) {
        return request({
            entity: ENTITY_CONTACT_PHONES,
            method: "POST",
            payload: sanitizePayload(oPayload, CONTACT_PHONE_FIELDS),
            errorMessage: "Impossibile salvare il numero di telefono.",
            useMessageBox: true
        });
    }

    function deleteContactPhone(iId) {
        return request({
            entity: ENTITY_CONTACT_PHONES,
            query: { id: iId },
            method: "DELETE",
            errorMessage: "Impossibile eliminare il numero di telefono.",
            useMessageBox: true
        });
    }

    async function replaceContactPhones(iContactId, aPhones) {
        var aExistingPhones = await listContactPhones(iContactId);
        var aDeletePromises = (aExistingPhones || []).map(function (oPhone) {
            return deleteContactPhone(oPhone.id);
        });

        await Promise.all(aDeletePromises);

        var aCreatePromises = (aPhones || []).map(function (oPhone) {
            return createContactPhone(Object.assign({}, oPhone, {
                contact_id: iContactId
            }));
        });

        await Promise.all(aCreatePromises);
    }

    function listBuyerProfiles(mFilters) {
        return request({
            entity: ENTITY_BUYER_PROFILES,
            query: mFilters,
            method: "GET",
            errorMessage: "Impossibile caricare il profilo acquirente.",
            useMessageBox: true
        });
    }

    async function getBuyerProfileByContactId(iContactId) {
        var aProfiles = await listBuyerProfiles({ contact_id: iContactId });
        return aProfiles && aProfiles.length ? aProfiles[0] : null;
    }

    function createBuyerProfile(oPayload) {
        return request({
            entity: ENTITY_BUYER_PROFILES,
            method: "POST",
            payload: sanitizePayload(oPayload, BUYER_PROFILE_FIELDS),
            errorMessage: "Impossibile creare il profilo acquirente.",
            useMessageBox: true
        });
    }

    function updateBuyerProfile(iId, oPayload) {
        return request({
            entity: ENTITY_BUYER_PROFILES,
            query: { id: iId },
            method: "PUT",
            payload: sanitizePayload(oPayload, BUYER_PROFILE_FIELDS),
            errorMessage: "Impossibile aggiornare il profilo acquirente.",
            useMessageBox: true
        });
    }

    function deleteBuyerProfile(iId) {
        return request({
            entity: ENTITY_BUYER_PROFILES,
            query: { id: iId },
            method: "DELETE",
            payload: null,
            errorMessage: "Impossibile eliminare il profilo acquirente.",
            useMessageBox: true
        });
    }

    function listBuyerPreferences(iBuyerProfileId) {
        return request({
            entity: ENTITY_BUYER_PREFERENCES,
            query: { buyer_profile_id: iBuyerProfileId },
            method: "GET",
            errorMessage: "Impossibile caricare le preferenze acquirente.",
            useMessageBox: true
        });
    }

    function createBuyerPreference(oPayload) {
        return request({
            entity: ENTITY_BUYER_PREFERENCES,
            method: "POST",
            payload: sanitizePayload(oPayload, BUYER_PREFERENCE_FIELDS),
            errorMessage: "Impossibile salvare una preferenza acquirente.",
            useMessageBox: true
        });
    }

    function deleteBuyerPreference(iId) {
        return request({
            entity: ENTITY_BUYER_PREFERENCES,
            query: { id: iId },
            method: "DELETE",
            errorMessage: "Impossibile eliminare una preferenza acquirente.",
            useMessageBox: true
        });
    }

    async function upsertBuyerProfileByContactId(iContactId, oPayload) {
        var oExistingProfile = await getBuyerProfileByContactId(iContactId);
        var oSanitizedPayload = sanitizePayload(Object.assign({}, oPayload, { contact_id: iContactId }), BUYER_PROFILE_FIELDS);

        if (oExistingProfile && oExistingProfile.id) {
            return updateBuyerProfile(oExistingProfile.id, oSanitizedPayload);
        }

        return createBuyerProfile(oSanitizedPayload);
    }

    async function replaceBuyerPreferences(iBuyerProfileId, aPreferences) {
        var aExistingPreferences = await listBuyerPreferences(iBuyerProfileId);
        var aDeletePromises = (aExistingPreferences || []).map(function (oPreference) {
            return deleteBuyerPreference(oPreference.id);
        });

        await Promise.all(aDeletePromises);

        var aCreatePromises = (aPreferences || []).map(function (oPreference) {
            return createBuyerPreference(Object.assign({}, oPreference, {
                buyer_profile_id: iBuyerProfileId
            }));
        });

        await Promise.all(aCreatePromises);
    }

    function listActivities(iContactId, mFilters) {
        return request({
            entity: ENTITY_ACTIVITIES,
            query: Object.assign({}, mFilters, { contact_id: iContactId }),
            method: "GET",
            errorMessage: "Impossibile caricare le attività.",
            useMessageBox: false
        });
    }

    function createActivity(oPayload) {
        return request({
            entity: ENTITY_ACTIVITIES,
            method: "POST",
            payload: sanitizePayload(oPayload, ACTIVITY_FIELDS),
            errorMessage: "Impossibile creare l'attività.",
            useMessageBox: true
        });
    }

    function updateActivity(iId, oPayload) {
        return request({
            entity: ENTITY_ACTIVITIES,
            query: { id: iId },
            method: "PUT",
            payload: sanitizePayload(oPayload, ACTIVITY_FIELDS),
            errorMessage: "Impossibile aggiornare l'attività.",
            useMessageBox: true
        });
    }

    function deleteActivity(iId) {
        return request({
            entity: ENTITY_ACTIVITIES,
            query: { id: iId },
            method: "DELETE",
            errorMessage: "Impossibile eliminare l'attività.",
            useMessageBox: true
        });
    }

    function listNotes(iContactId, mFilters) {
        return request({
            entity: ENTITY_NOTES,
            query: Object.assign({}, mFilters, { contact_id: iContactId }),
            method: "GET",
            errorMessage: "Impossibile caricare le note.",
            useMessageBox: false
        });
    }

    function createNote(oPayload) {
        return request({
            entity: ENTITY_NOTES,
            method: "POST",
            payload: sanitizePayload(oPayload, NOTE_FIELDS),
            errorMessage: "Impossibile creare la nota.",
            useMessageBox: true
        });
    }

    function updateNote(iId, oPayload) {
        return request({
            entity: ENTITY_NOTES,
            query: { id: iId },
            method: "PUT",
            payload: sanitizePayload(oPayload, NOTE_FIELDS),
            errorMessage: "Impossibile aggiornare la nota.",
            useMessageBox: true
        });
    }

    function deleteNote(iId) {
        return request({
            entity: ENTITY_NOTES,
            query: { id: iId },
            method: "DELETE",
            errorMessage: "Impossibile eliminare la nota.",
            useMessageBox: true
        });
    }

    return {
        listContacts: listContacts,
        getContact: getContact,
        createContact: createContact,
        updateContact: updateContact,
        deleteContact: deleteContact,
        listContactPhones: listContactPhones,
        replaceContactPhones: replaceContactPhones,
        getBuyerProfileByContactId: getBuyerProfileByContactId,
        createBuyerProfile: createBuyerProfile,
        updateBuyerProfile: updateBuyerProfile,
        deleteBuyerProfile: deleteBuyerProfile,
        listBuyerPreferences: listBuyerPreferences,
        replaceBuyerPreferences: replaceBuyerPreferences,
        upsertBuyerProfileByContactId: upsertBuyerProfileByContactId,
        listActivities: listActivities,
        createActivity: createActivity,
        updateActivity: updateActivity,
        deleteActivity: deleteActivity,
        listNotes: listNotes,
        createNote: createNote,
        updateNote: updateNote,
        deleteNote: deleteNote
    };
});
