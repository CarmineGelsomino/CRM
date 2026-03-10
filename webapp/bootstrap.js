sap.ui.define([
    "sap/ui/core/ComponentContainer",
    "sap/ui/core/Component"
], function (ComponentContainer, Component) {
    "use strict";

    Component.create({
        name: "crm"
    }).then(function (oComponent) {
        new ComponentContainer({
            component: oComponent,
            height: "100%"
        }).placeAt("content");
    }).catch(function () {
        sap.ui.require(["sap/m/MessageBox"], function (MessageBox) {
            MessageBox.error("Errore caricamento applicazione.");
        });
    });
});
