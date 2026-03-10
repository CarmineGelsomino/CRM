sap.ui.define([
    "crm/controller/BaseController.controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (BaseController, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("crm.controller.contactTile.ContactDetail", {
        onInit: function () {
            this.getRouter().getRoute("contactDetail").attachPatternMatched(this._onRouteMatched, this);
            this.setModel(this.getOwnerComponent().getModel("contacts"), "contacts");
            this._sContactId = null;
            this._selectedActivityId = null;
            this._selectedNoteId = null;
        },

        _apiRequest: function (sPath, mOptions) {
            return fetch(window.CRM_CONFIG.apiBaseUrl + "/index.php" + sPath, Object.assign({
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                }
            }, mOptions || {})).then(function (oResponse) {
                return oResponse.json();
            });
        },

        _onRouteMatched: function (oEvent) {
            var sContactId = oEvent.getParameter("arguments").contactId;
            this._sContactId = sContactId;

            if (sContactId === "new") {
                this.getModel("contacts").setProperty("/selectedContact", {
                    id: null,
                    user_id: 1,
                    first_name: "",
                    last_name: "",
                    email: "",
                    category: "cliente",
                    status: "attivo",
                    generic_info: "",
                    phone: ""
                });
                this.getModel("contacts").setProperty("/filteredActivities", []);
                this.getModel("contacts").setProperty("/filteredNotes", []);
                return;
            }

            this._loadContactData(sContactId);
        },

        _loadContactData: function (sContactId) {
            Promise.all([
                this._apiRequest("?entity=contacts&id=" + encodeURIComponent(sContactId)),
                this._apiRequest("?entity=contact_phones&contact_id=" + encodeURIComponent(sContactId)),
                this._apiRequest("?entity=activities&contact_id=" + encodeURIComponent(sContactId)),
                this._apiRequest("?entity=notes&contact_id=" + encodeURIComponent(sContactId))
            ]).then(function (aResponses) {
                var oContact = aResponses[0].data;
                if (!oContact) {
                    MessageBox.error("Contatto non trovato");
                    this.navTo("contacts");
                    return;
                }

                var aPhones = aResponses[1].data || [];
                var oPrimaryPhone = aPhones.find(function (oPhone) {
                    return Number(oPhone.is_primary) === 1;
                }) || aPhones[0];
                oContact.phone = oPrimaryPhone ? oPrimaryPhone.phone : "";

                this.getModel("contacts").setProperty("/selectedContact", oContact);
                this.getModel("contacts").setProperty("/filteredActivities", aResponses[2].data || []);
                this.getModel("contacts").setProperty("/filteredNotes", aResponses[3].data || []);
            }.bind(this)).catch(function () {
                MessageBox.error("Errore caricamento dettaglio contatto.");
            });
        },

        onSaveContact: function () {
            var oContact = Object.assign({}, this.getModel("contacts").getProperty("/selectedContact"));
            var sPhone = oContact.phone || "";
            delete oContact.phone;

            var bIsNew = !oContact.id;
            var sPath = bIsNew ? "?entity=contacts" : "?entity=contacts&id=" + encodeURIComponent(oContact.id);
            var sMethod = bIsNew ? "POST" : "PUT";

            this._apiRequest(sPath, {
                method: sMethod,
                body: JSON.stringify(oContact)
            }).then(function (oResponse) {
                var oSaved = oResponse.data;
                if (!oSaved) {
                    MessageBox.error("Salvataggio contatto fallito.");
                    return;
                }

                var pPhone = Promise.resolve();
                if (sPhone) {
                    pPhone = this._apiRequest("?entity=contact_phones&contact_id=" + encodeURIComponent(oSaved.id))
                        .then(function (oPhoneRes) {
                            var aPhones = oPhoneRes.data || [];
                            var oExisting = aPhones[0];
                            if (oExisting) {
                                return this._apiRequest("?entity=contact_phones&id=" + encodeURIComponent(oExisting.id), {
                                    method: "PUT",
                                    body: JSON.stringify({ phone: sPhone, is_primary: 1 })
                                });
                            }

                            return this._apiRequest("?entity=contact_phones", {
                                method: "POST",
                                body: JSON.stringify({ contact_id: oSaved.id, phone: sPhone, is_primary: 1, note: "" })
                            });
                        }.bind(this));
                }

                pPhone.then(function () {
                    MessageToast.show("Contatto salvato");
                    this.navTo("contactDetail", { contactId: String(oSaved.id) }, true);
                    this._loadContactData(String(oSaved.id));
                }.bind(this));
            }.bind(this)).catch(function () {
                MessageBox.error("Salvataggio contatto fallito.");
            });
        },

        onDeleteContact: function () {
            var oContact = this.getModel("contacts").getProperty("/selectedContact");
            if (!oContact || !oContact.id) {
                this.navTo("contacts");
                return;
            }

            MessageBox.confirm("Eliminare il contatto?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }
                    this._apiRequest("?entity=contacts&id=" + encodeURIComponent(oContact.id), { method: "DELETE" })
                        .then(function () {
                            MessageToast.show("Contatto eliminato");
                            this.navTo("contacts");
                        }.bind(this));
                }.bind(this)
            });
        },

        onActivityFilter: function () {
            var sText = (this.byId("activitySearch").getValue() || "").toLowerCase();
            var sStatus = this.byId("activityStatusFilter").getSelectedKey();
            this._apiRequest("?entity=activities&contact_id=" + encodeURIComponent(this.getModel("contacts").getProperty("/selectedContact/id")))
                .then(function (oRes) {
                    var aActivities = (oRes.data || []).filter(function (oActivity) {
                        var bStatus = sStatus === "all" || oActivity.status === sStatus;
                        var bText = !sText || (oActivity.title || "").toLowerCase().indexOf(sText) > -1 || (oActivity.description || "").toLowerCase().indexOf(sText) > -1;
                        return bStatus && bText;
                    });
                    this.getModel("contacts").setProperty("/filteredActivities", aActivities);
                }.bind(this));
        },

        onNotesFilter: function (oEvent) {
            var sText = ((oEvent && oEvent.getParameter("newValue")) || this.byId("notesSearch").getValue() || "").toLowerCase();
            this._apiRequest("?entity=notes&contact_id=" + encodeURIComponent(this.getModel("contacts").getProperty("/selectedContact/id")))
                .then(function (oRes) {
                    var aNotes = (oRes.data || []).filter(function (oNote) {
                        return !sText || (oNote.message || "").toLowerCase().indexOf(sText) > -1;
                    });
                    this.getModel("contacts").setProperty("/filteredNotes", aNotes);
                }.bind(this));
        },

        onActivitySelectionChange: function (oEvent) {
            this._selectedActivityId = oEvent.getParameter("listItem").getBindingContext("contacts").getProperty("id");
        },

        onNoteSelectionChange: function (oEvent) {
            this._selectedNoteId = oEvent.getParameter("listItem").getBindingContext("contacts").getProperty("id");
        },

        onAddActivity: function () {
            var sTitle = window.prompt("Titolo attività");
            if (!sTitle) { return; }
            this._apiRequest("?entity=activities", {
                method: "POST",
                body: JSON.stringify({
                    user_id: 1,
                    contact_id: this.getModel("contacts").getProperty("/selectedContact/id"),
                    activity_type: "task",
                    title: sTitle,
                    description: "",
                    priority: "media",
                    status: "aperta"
                })
            }).then(function () {
                this.onActivityFilter();
                MessageToast.show("Attività aggiunta");
            }.bind(this));
        },

        onUpdateActivity: function () {
            if (!this._selectedActivityId) {
                MessageToast.show("Seleziona un'attività");
                return;
            }
            var sTitle = window.prompt("Nuovo titolo attività");
            if (!sTitle) { return; }
            this._apiRequest("?entity=activities&id=" + encodeURIComponent(this._selectedActivityId), {
                method: "PUT",
                body: JSON.stringify({ title: sTitle })
            }).then(function () {
                this.onActivityFilter();
                MessageToast.show("Attività aggiornata");
            }.bind(this));
        },

        onDeleteActivity: function () {
            if (!this._selectedActivityId) {
                MessageToast.show("Seleziona un'attività");
                return;
            }
            this._apiRequest("?entity=activities&id=" + encodeURIComponent(this._selectedActivityId), { method: "DELETE" })
                .then(function () {
                    this._selectedActivityId = null;
                    this.onActivityFilter();
                    MessageToast.show("Attività eliminata");
                }.bind(this));
        },

        onAddNote: function () {
            var sMessage = window.prompt("Testo nota");
            if (!sMessage) { return; }
            this._apiRequest("?entity=notes", {
                method: "POST",
                body: JSON.stringify({
                    user_id: 1,
                    contact_id: this.getModel("contacts").getProperty("/selectedContact/id"),
                    message: sMessage
                })
            }).then(function () {
                this.onNotesFilter();
                MessageToast.show("Nota aggiunta");
            }.bind(this));
        },

        onUpdateNote: function () {
            if (!this._selectedNoteId) {
                MessageToast.show("Seleziona una nota");
                return;
            }
            var sMessage = window.prompt("Nuovo testo nota");
            if (!sMessage) { return; }
            this._apiRequest("?entity=notes&id=" + encodeURIComponent(this._selectedNoteId), {
                method: "PUT",
                body: JSON.stringify({ message: sMessage })
            }).then(function () {
                this.onNotesFilter();
                MessageToast.show("Nota aggiornata");
            }.bind(this));
        },

        onDeleteNote: function () {
            if (!this._selectedNoteId) {
                MessageToast.show("Seleziona una nota");
                return;
            }
            this._apiRequest("?entity=notes&id=" + encodeURIComponent(this._selectedNoteId), { method: "DELETE" })
                .then(function () {
                    this._selectedNoteId = null;
                    this.onNotesFilter();
                    MessageToast.show("Nota eliminata");
                }.bind(this));
        }
    });
});
