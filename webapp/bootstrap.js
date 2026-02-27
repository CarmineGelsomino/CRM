sap.ui.define([
    "sap/ui/core/ComponentContainer",
    "sap/ui/core/Component",
    "sap/base/i18n/ResourceBundle"
], function (ComponentContainer, Component, ResourceBundle) {
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

    function showBootstrapError() {
        ResourceBundle.create({
            url: "webapp/i18n/i18n.properties"
        }).then(function (oBundle) {
            sap.ui.require(["sap/m/MessageBox"], function (MessageBox) {
                MessageBox.error(oBundle.getText("bootstrapError"));
            });
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
            showBootstrapError();
        });
});
