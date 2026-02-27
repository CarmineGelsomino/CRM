sap.ui.define([
    "sap/ui/core/ComponentContainer",
    "sap/ui/core/Component"
], function (ComponentContainer, Component) {
    "use strict";

    function startApp(manifest) {
        Component.create({
            name: "crm",
            manifest: manifest
        }).then(function (oComponent) {
            new ComponentContainer({
                component: oComponent,
                height: "100%"
            }).placeAt("content");
        });
    }

    fetch(window.CRM_CONFIG.manifestUrl, { credentials: "same-origin" })
        .then(function (response) {
            return response.json();
        })
        .then(function (manifest) {
            startApp(manifest);
        })
        .catch(function () {
            sap.ui.require(["sap/m/MessageBox"], function (MessageBox) {
                MessageBox.error("Errore caricamento configurazione applicazione.");
            });
        });
});
