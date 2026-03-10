sap.ui.define([
    "sap/ui/core/ComponentContainer",
    "sap/ui/core/Component"
], function (ComponentContainer, Component) {
    "use strict";

    fetch("./manifest.php", {
        credentials: "same-origin"
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("manifest_request_failed");
            }
            return response.json();
        })
        .then(function (oManifest) {
            return Component.create({
                name: "crm",
                manifest: oManifest
            });
        })
        .then(function (oComponent) {
            new ComponentContainer({
                component: oComponent,
                height: "100%"
            }).placeAt("content");
        })
        .catch(function () {
            sap.ui.require(["sap/m/MessageBox"], function (MessageBox) {
                MessageBox.error("Errore caricamento applicazione.");
            });
        });
});
