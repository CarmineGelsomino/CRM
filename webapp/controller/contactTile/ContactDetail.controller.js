sap.ui.define([
    "crm/controller/BaseController.controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (BaseController, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("crm.controller.contactTile.ContactDetail", {
        onInit: function () {
            this.getRouter().getRoute("contactDetail").attachPatternMatched(this._onRouteMatched, this);
            this.getView().setModel(this.getOwnerComponent().getModel("contacts"), "contacts");
            this._sActivitySearch = "";
            this._sActivityStatus = "all";
            this._sNoteSearch = "";
            this._sSelectedActivityId = null;
            this._sSelectedNoteId = null;
        },

        _onRouteMatched: function (oEvent) {
            var sContactId = oEvent.getParameter("arguments").contactId;
            var oModel = this.getModel("contacts");
            var aContacts = oModel.getProperty("/contacts") || [];
            var oContact = aContacts.find(function (oItem) {
                return oItem.id === sContactId;
            });

            if (!oContact) {
                MessageToast.show("Contatto non trovato");
                this.navTo("contacts");
                return;
            }

            oModel.setProperty("/selectedContact", Object.assign({}, oContact));
            this._loadRelatedData(sContactId);
        },

        _loadRelatedData: function (sContactId) {
            var oModel = this.getModel("contacts");
            var aActivities = (oModel.getProperty("/activities") || []).filter(function (oActivity) {
                return oActivity.contactId === sContactId;
            });
            var aNotes = (oModel.getProperty("/notes") || []).filter(function (oNote) {
                return oNote.contactId === sContactId;
            });

            oModel.setProperty("/filteredActivities", aActivities);
            oModel.setProperty("/filteredNotes", aNotes);
        },

        onSaveContact: function () {
            var oModel = this.getModel("contacts");
            var oSelected = oModel.getProperty("/selectedContact");
            var aContacts = oModel.getProperty("/contacts") || [];
            var iIndex = aContacts.findIndex(function (oContact) {
                return oContact.id === oSelected.id;
            });

            if (iIndex === -1) {
                MessageToast.show("Impossibile aggiornare il contatto");
                return;
            }

            aContacts[iIndex] = Object.assign({}, oSelected);
            oModel.setProperty("/contacts", aContacts);
            MessageToast.show("Contatto aggiornato");
        },

        onDeleteContact: function () {
            var oModel = this.getModel("contacts");
            var oSelected = oModel.getProperty("/selectedContact");
            if (!oSelected) {
                return;
            }

            MessageBox.confirm("Eliminare il contatto e i dati correlati?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    oModel.setProperty("/contacts", (oModel.getProperty("/contacts") || []).filter(function (oContact) {
                        return oContact.id !== oSelected.id;
                    }));
                    oModel.setProperty("/activities", (oModel.getProperty("/activities") || []).filter(function (oActivity) {
                        return oActivity.contactId !== oSelected.id;
                    }));
                    oModel.setProperty("/notes", (oModel.getProperty("/notes") || []).filter(function (oNote) {
                        return oNote.contactId !== oSelected.id;
                    }));
                    MessageToast.show("Contatto eliminato");
                    this.navTo("contacts");
                }.bind(this)
            });
        },

        onActivityFilter: function () {
            this._sActivitySearch = this.byId("activitySearch").getValue().trim().toLowerCase();
            this._sActivityStatus = this.byId("activityStatusFilter").getSelectedKey();
            this._applyActivityFilter();
        },

        _applyActivityFilter: function () {
            var oModel = this.getModel("contacts");
            var sContactId = oModel.getProperty("/selectedContact/id");
            var aActivities = (oModel.getProperty("/activities") || []).filter(function (oActivity) {
                if (oActivity.contactId !== sContactId) {
                    return false;
                }

                var bMatchesText = !this._sActivitySearch || oActivity.description.toLowerCase().indexOf(this._sActivitySearch) > -1 || oActivity.type.toLowerCase().indexOf(this._sActivitySearch) > -1;
                var bMatchesStatus = this._sActivityStatus === "all" || oActivity.status === this._sActivityStatus;
                return bMatchesText && bMatchesStatus;
            }.bind(this));

            oModel.setProperty("/filteredActivities", aActivities);
        },

        onNotesFilter: function (oEvent) {
            var sValue = oEvent && oEvent.getParameter ? oEvent.getParameter("newValue") : this.byId("notesSearch").getValue();
            this._sNoteSearch = (sValue || "").trim().toLowerCase();
            var oModel = this.getModel("contacts");
            var sContactId = oModel.getProperty("/selectedContact/id");
            var aNotes = (oModel.getProperty("/notes") || []).filter(function (oNote) {
                if (oNote.contactId !== sContactId) {
                    return false;
                }

                if (!this._sNoteSearch) {
                    return true;
                }

                return oNote.title.toLowerCase().indexOf(this._sNoteSearch) > -1 || oNote.text.toLowerCase().indexOf(this._sNoteSearch) > -1;
            }.bind(this));

            oModel.setProperty("/filteredNotes", aNotes);
        },

        onActivitySelectionChange: function (oEvent) {
            this._sSelectedActivityId = oEvent.getParameter("listItem").getBindingContext("contacts").getProperty("id");
        },

        onNoteSelectionChange: function (oEvent) {
            this._sSelectedNoteId = oEvent.getParameter("listItem").getBindingContext("contacts").getProperty("id");
        },

        onAddActivity: function () {
            var sDescription = window.prompt("Descrizione attività:");
            if (!sDescription) {
                return;
            }

            var oModel = this.getModel("contacts");
            var sContactId = oModel.getProperty("/selectedContact/id");
            var aActivities = oModel.getProperty("/activities") || [];
            aActivities.push({
                id: "A" + String(Date.now()).slice(-6),
                contactId: sContactId,
                type: "Task",
                status: "aperta",
                date: new Date().toISOString().slice(0, 10),
                description: sDescription
            });
            oModel.setProperty("/activities", aActivities);
            this._applyActivityFilter();
            MessageToast.show("Attività aggiunta");
        },

        onUpdateActivity: function () {
            if (!this._sSelectedActivityId) {
                MessageToast.show("Seleziona un'attività");
                return;
            }

            var oModel = this.getModel("contacts");
            var aActivities = oModel.getProperty("/activities") || [];
            var oActivity = aActivities.find(function (oItem) {
                return oItem.id === this._sSelectedActivityId;
            }.bind(this));
            if (!oActivity) {
                return;
            }

            var sValue = window.prompt("Nuova descrizione:", oActivity.description);
            if (!sValue) {
                return;
            }

            oActivity.description = sValue;
            oModel.setProperty("/activities", aActivities);
            this._applyActivityFilter();
            MessageToast.show("Attività aggiornata");
        },

        onDeleteActivity: function () {
            if (!this._sSelectedActivityId) {
                MessageToast.show("Seleziona un'attività");
                return;
            }

            var oModel = this.getModel("contacts");
            oModel.setProperty("/activities", (oModel.getProperty("/activities") || []).filter(function (oItem) {
                return oItem.id !== this._sSelectedActivityId;
            }.bind(this)));
            this._sSelectedActivityId = null;
            this._applyActivityFilter();
            MessageToast.show("Attività eliminata");
        },

        onAddNote: function () {
            var sTitle = window.prompt("Titolo nota:");
            if (!sTitle) {
                return;
            }

            var sText = window.prompt("Contenuto nota:") || "";
            var oModel = this.getModel("contacts");
            var aNotes = oModel.getProperty("/notes") || [];
            aNotes.push({
                id: "N" + String(Date.now()).slice(-6),
                contactId: oModel.getProperty("/selectedContact/id"),
                title: sTitle,
                text: sText,
                createdAt: new Date().toISOString().slice(0, 10)
            });
            oModel.setProperty("/notes", aNotes);
            this.onNotesFilter({ getParameter: function () { return this._sNoteSearch; }.bind(this) });
            MessageToast.show("Nota aggiunta");
        },

        onUpdateNote: function () {
            if (!this._sSelectedNoteId) {
                MessageToast.show("Seleziona una nota");
                return;
            }

            var oModel = this.getModel("contacts");
            var aNotes = oModel.getProperty("/notes") || [];
            var oNote = aNotes.find(function (oItem) {
                return oItem.id === this._sSelectedNoteId;
            }.bind(this));
            if (!oNote) {
                return;
            }

            var sText = window.prompt("Aggiorna testo nota:", oNote.text);
            if (sText === null) {
                return;
            }

            oNote.text = sText;
            oModel.setProperty("/notes", aNotes);
            this.onNotesFilter({ getParameter: function () { return this._sNoteSearch; }.bind(this) });
            MessageToast.show("Nota aggiornata");
        },

        onDeleteNote: function () {
            if (!this._sSelectedNoteId) {
                MessageToast.show("Seleziona una nota");
                return;
            }

            var oModel = this.getModel("contacts");
            oModel.setProperty("/notes", (oModel.getProperty("/notes") || []).filter(function (oItem) {
                return oItem.id !== this._sSelectedNoteId;
            }.bind(this)));
            this._sSelectedNoteId = null;
            this.onNotesFilter({ getParameter: function () { return this._sNoteSearch; }.bind(this) });
            MessageToast.show("Nota eliminata");
        }
    });
});
