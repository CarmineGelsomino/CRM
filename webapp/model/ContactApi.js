sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (MessageBox, MessageToast) {
    "use strict";

    var ENTITY_CONTACTS = "contacts";
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
