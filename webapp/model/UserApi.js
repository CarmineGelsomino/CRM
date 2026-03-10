sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (MessageBox, MessageToast) {
    "use strict";

    var ENTITY_USERS = "users";
    var USER_FIELDS = [
        "first_name",
        "last_name",
        "email",
        "is_active"
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

    async function request(oOptions) {
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

        var oResponse = await fetch(oOptions.url, oFetchOptions);
        return parseResponse(oResponse);
    }

    async function getUser(iId) {
        try {
            var oResult = await request({
                method: "GET",
                url: buildUrl(ENTITY_USERS, { id: iId })
            });
            return oResult.data;
        } catch (oError) {
            MessageBox.error((oError && oError.message) || "Impossibile caricare il profilo utente.");
            throw oError;
        }
    }

    async function updateUser(iId, oPayload) {
        try {
            var oResult = await request({
                method: "PUT",
                url: buildUrl(ENTITY_USERS, { id: iId }),
                payload: sanitizePayload(oPayload, USER_FIELDS)
            });
            MessageToast.show("Profilo aggiornato correttamente.");
            return oResult.data;
        } catch (oError) {
            MessageBox.error((oError && oError.message) || "Impossibile aggiornare il profilo utente.");
            throw oError;
        }
    }

    async function resetPassword(oPayload) {
        try {
            var oResult = await request({
                method: "POST",
                url: buildUrl(ENTITY_USERS, { action: "reset-password" }),
                payload: oPayload
            });
            MessageToast.show("Password reimpostata con successo.");
            return oResult;
        } catch (oError) {
            MessageBox.error((oError && oError.message) || "Impossibile reimpostare la password.");
            throw oError;
        }
    }

    return {
        getUser: getUser,
        updateUser: updateUser,
        resetPassword: resetPassword
    };
});
