sap.ui.define([
    "crm/controller/BaseController.controller",
    "crm/model/ContactApi",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/core/ListItem",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem",
    "sap/ui/core/format/DateFormat"
], function (
    BaseController,
    ContactApi,
    JSONModel,
    Filter,
    FilterOperator,
    Sorter,
    MessageBox,
    MessageToast,
    Dialog,
    Button,
    Label,
    Input,
    TextArea,
    SimpleForm,
    ListItem,
    ViewSettingsDialog,
    ViewSettingsItem,
    DateFormat
) {
    "use strict";

    var oDateTimeFormatter = DateFormat.getDateTimeInstance({
        style: "medium"
    });

    function formatDateTime(sValue) {
        if (!sValue) {
            return "";
        }

        var oDate = new Date(sValue);

        if (Number.isNaN(oDate.getTime())) {
            return sValue;
        }

        return oDateTimeFormatter.format(oDate);
    }

    function normalizeSearchValue(sValue) {
        return (sValue || "").toLowerCase().replace(/\s+/g, " ").trim();
    }

    function buildContactDisplay(oContact) {
        var sFullName = ((oContact.first_name || "") + " " + (oContact.last_name || "")).trim();
        return sFullName || oContact.email || (oContact.id ? String(oContact.id) : "");
    }

    return BaseController.extend("crm.controller.noteTile.Notes", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");
            this.setModel(new JSONModel({
                searchQuery: "",
                contactValue: "",
                contactId: "",
                categoryKey: "",
                statusKey: ""
            }), "noteFilters");
            this.setModel(new JSONModel({
                notes: [],
                contacts: [],
                busy: false,
                selectedNoteId: null,
                selectedNote: null
            }), "notes");

            this._oSortState = { path: "createdAtTimestamp", descending: true };
            this._loadData();
        },

        _loadData: async function () {
            var oModel = this.getModel("notes");
            oModel.setProperty("/busy", true);

            try {
                var aResults = await Promise.all([
                    ContactApi.listNotes(),
                    ContactApi.listContacts()
                ]);
                var aNotes = aResults[0] || [];
                var aContacts = aResults[1] || [];
                var mContactsById = aContacts.reduce(function (mMap, oContact) {
                    mMap[oContact.id] = oContact;
                    return mMap;
                }, {});

                oModel.setProperty("/contacts", aContacts);
                oModel.setProperty("/notes", aNotes.map(function (oNote) {
                    var oContact = mContactsById[oNote.contact_id] || {};
                    var sContactName = buildContactDisplay(oContact);

                    return Object.assign({}, oNote, {
                        contactFullName: sContactName,
                        contactEmail: oContact.email || "",
                        contactCategory: oContact.category || "",
                        contactStatus: oContact.status || "",
                        createdAtFormatted: formatDateTime(oNote.created_at),
                        updatedAtFormatted: formatDateTime(oNote.updated_at),
                        createdAtTimestamp: new Date(oNote.created_at || 0).getTime(),
                        updatedAtTimestamp: new Date(oNote.updated_at || 0).getTime(),
                        messagePreview: (oNote.message || "").trim().slice(0, 180)
                    });
                }));

                oModel.setProperty("/selectedNoteId", null);
                oModel.setProperty("/selectedNote", null);
                this.byId("notesTable").removeSelections(true);
                this._applyFiltersAndSort();
            } catch (oError) {
                // errors managed by API helpers
            } finally {
                oModel.setProperty("/busy", false);
            }
        },

        onRefreshNotes: async function () {
            await this._loadData();
        },

        onSelectionChange: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem && oItem.getBindingContext("notes");
            var oNote = oContext ? oContext.getObject() : null;

            this.getModel("notes").setProperty("/selectedNote", oNote);
            this.getModel("notes").setProperty("/selectedNoteId", oNote ? oNote.id : null);
        },

        onFilterChange: function () {
            this._applyFiltersAndSort();
        },

        onContactFilterLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oModel = this.getModel("noteFilters");

            oModel.setProperty("/contactValue", sValue);
            oModel.setProperty("/contactId", "");
            this._applyFiltersAndSort();
        },

        onSuggestContact: function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = normalizeSearchValue(oEvent.getParameter("suggestValue"));
            var aContacts = this.getModel("notes").getProperty("/contacts") || [];
            var aMatches;

            if (sValue.length < 2) {
                oInput.destroySuggestionItems();
                return;
            }

            aMatches = aContacts.filter(function (oContact) {
                var sLabel = normalizeSearchValue(buildContactDisplay(oContact));
                var sEmail = normalizeSearchValue(oContact.email || "");
                return sLabel.indexOf(sValue) !== -1 || sEmail.indexOf(sValue) !== -1;
            }).slice(0, 10);

            oInput.destroySuggestionItems();
            aMatches.forEach(function (oContact) {
                oInput.addSuggestionItem(new ListItem({
                    key: String(oContact.id),
                    text: buildContactDisplay(oContact),
                    additionalText: oContact.email || ""
                }));
            });
        },

        onFilterContactSuggestionSelected: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oModel = this.getModel("noteFilters");

            if (!oSelectedItem) {
                return;
            }

            oModel.setProperty("/contactValue", oSelectedItem.getText());
            oModel.setProperty("/contactId", oSelectedItem.getKey());
            this._applyFiltersAndSort();
        },

        onDialogContactLiveChange: function (oEvent) {
            var oModel = oEvent.getSource().getModel("dialog");

            if (!oModel) {
                return;
            }

            oModel.setProperty("/contact_display", oEvent.getParameter("value"));
            oModel.setProperty("/contact_id", "");
        },

        onDialogContactSuggestionSelected: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oModel = oEvent.getSource().getModel("dialog");

            if (!oSelectedItem || !oModel) {
                return;
            }

            oModel.setProperty("/contact_display", oSelectedItem.getText());
            oModel.setProperty("/contact_id", oSelectedItem.getKey());
        },

        onClearFilters: function () {
            this.getModel("noteFilters").setData({
                searchQuery: "",
                contactValue: "",
                contactId: "",
                categoryKey: "",
                statusKey: ""
            });
            this._applyFiltersAndSort();
        },

        _applyFiltersAndSort: function () {
            var oFilterData = this.getModel("noteFilters").getData() || {};
            var sQuery = (oFilterData.searchQuery || "").trim();
            var sContactValue = (oFilterData.contactValue || "").trim();
            var sContactId = String(oFilterData.contactId || "").trim();
            var sCategory = (oFilterData.categoryKey || "").trim();
            var sStatus = (oFilterData.statusKey || "").trim();
            var aFilters = [];
            var oBinding = this.byId("notesTable").getBinding("items");

            if (!oBinding) {
                return;
            }

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("message", FilterOperator.Contains, sQuery),
                        new Filter("contactFullName", FilterOperator.Contains, sQuery),
                        new Filter("contactEmail", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            if (sContactId) {
                aFilters.push(new Filter("contact_id", FilterOperator.EQ, Number(sContactId)));
            } else if (sContactValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("contactFullName", FilterOperator.Contains, sContactValue),
                        new Filter("contactEmail", FilterOperator.Contains, sContactValue)
                    ],
                    and: false
                }));
            }

            if (sCategory) {
                aFilters.push(new Filter("contactCategory", FilterOperator.EQ, sCategory));
            }

            if (sStatus) {
                aFilters.push(new Filter("contactStatus", FilterOperator.EQ, sStatus));
            }

            oBinding.filter(aFilters, "Application");
            oBinding.sort(new Sorter(this._oSortState.path, this._oSortState.descending));
        },

        onOpenSortDialog: function () {
            var oBundle = this.getResourceBundle();

            if (!this._oSortDialog) {
                this._oSortDialog = new ViewSettingsDialog({
                    confirm: this.onSortConfirm.bind(this),
                    sortItems: [
                        new ViewSettingsItem({ key: "createdAtTimestamp", text: oBundle.getText("notesSortCreatedAt") }),
                        new ViewSettingsItem({ key: "updatedAtTimestamp", text: oBundle.getText("notesSortUpdatedAt") }),
                        new ViewSettingsItem({ key: "contactFullName", text: oBundle.getText("notesSortContact") }),
                        new ViewSettingsItem({ key: "contactStatus", text: oBundle.getText("notesSortStatus") }),
                        new ViewSettingsItem({ key: "message", text: oBundle.getText("notesSortMessage") })
                    ]
                });
                this.getView().addDependent(this._oSortDialog);
            }

            this._oSortDialog.open();
        },

        onSortConfirm: function (oEvent) {
            var oSortItem = oEvent.getParameter("sortItem");
            this._oSortState.path = (oSortItem && oSortItem.getKey()) || "createdAtTimestamp";
            this._oSortState.descending = !!oEvent.getParameter("sortDescending");
            this._applyFiltersAndSort();
        },

        onCreateNote: function () {
            this._openNoteDialog();
        },

        onEditNote: function () {
            var oNote = this.getModel("notes").getProperty("/selectedNote");
            var oBundle = this.getResourceBundle();

            if (!oNote) {
                MessageToast.show(oBundle.getText("notesSelectToEdit"));
                return;
            }

            this._openNoteDialog(oNote);
        },

        onRowEdit: function (oEvent) {
            var oNote = oEvent.getSource().getBindingContext("notes").getObject();
            this._openNoteDialog(oNote);
        },

        _openNoteDialog: function (oNote) {
            var bEditMode = !!(oNote && oNote.id);
            var oBundle = this.getResourceBundle();
            var oDialogModel = new JSONModel({
                id: bEditMode ? oNote.id : null,
                contact_id: bEditMode ? String(oNote.contact_id || "") : "",
                contact_display: bEditMode ? (oNote.contactFullName || "") : "",
                message: bEditMode ? (oNote.message || "") : ""
            });
            var oDialog = new Dialog({
                title: bEditMode ? oBundle.getText("notesDialogEditTitle") : oBundle.getText("notesDialogCreateTitle"),
                contentWidth: "40rem",
                content: [
                    new SimpleForm({
                        editable: true,
                        layout: "ResponsiveGridLayout",
                        labelSpanXL: 12,
                        labelSpanL: 12,
                        labelSpanM: 12,
                        labelSpanS: 12,
                        columnsXL: 1,
                        columnsL: 1,
                        columnsM: 1,
                        content: [
                            new Label({ text: oBundle.getText("notesDialogFieldContact") }),
                            new Input({
                                width: "100%",
                                value: "{dialog>/contact_display}",
                                placeholder: oBundle.getText("notesDialogContactPlaceholder"),
                                showSuggestion: true,
                                startSuggestion: 2,
                                suggest: this.onSuggestContact.bind(this),
                                suggestionItemSelected: this.onDialogContactSuggestionSelected.bind(this),
                                liveChange: this.onDialogContactLiveChange.bind(this)
                            }),
                            new Label({ text: oBundle.getText("notesDialogFieldMessage") }),
                            new TextArea({
                                value: "{dialog>/message}",
                                width: "100%",
                                rows: 8,
                                maxLength: 5000,
                                growing: true,
                                placeholder: oBundle.getText("notesDialogFieldMessagePlaceholder")
                            })
                        ]
                    })
                ],
                beginButton: new Button({
                    type: "Emphasized",
                    text: oBundle.getText("notesDialogSaveButton"),
                    press: async function () {
                        var oData = oDialogModel.getData();
                        var sMessage = (oData.message || "").trim();
                        var sContactId = String(oData.contact_id || "").trim();

                        if (!sContactId || !sMessage) {
                            MessageToast.show(oBundle.getText("notesValidationRequired"));
                            return;
                        }

                        try {
                            if (bEditMode) {
                                await ContactApi.updateNote(oData.id, {
                                    contact_id: Number(sContactId),
                                    message: sMessage,
                                    user_id: this.getModel("session").getProperty("/userId")
                                });
                                MessageToast.show(oBundle.getText("notesUpdateSuccess"));
                            } else {
                                await ContactApi.createNote({
                                    contact_id: Number(sContactId),
                                    message: sMessage,
                                    user_id: this.getModel("session").getProperty("/userId")
                                });
                                MessageToast.show(oBundle.getText("notesCreateSuccess"));
                            }
                            oDialog.close();
                            await this._loadData();
                        } catch (oError) {
                            // API handles messages
                        }
                    }.bind(this)
                }),
                endButton: new Button({
                    text: oBundle.getText("notesDialogCancelButton"),
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.setModel(oDialogModel, "dialog");
            oDialog.setModel(this.getModel("notes"), "notes");
            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        onDeleteNote: function () {
            var oNote = this.getModel("notes").getProperty("/selectedNote");
            var oBundle = this.getResourceBundle();

            if (!oNote) {
                MessageToast.show(oBundle.getText("notesSelectToDelete"));
                return;
            }

            this._confirmDelete(oNote);
        },

        onRowDelete: function (oEvent) {
            var oNote = oEvent.getSource().getBindingContext("notes").getObject();
            this._confirmDelete(oNote);
        },

        _confirmDelete: function (oNote) {
            var oBundle = this.getResourceBundle();
            var sMessage = (oNote.message || "").slice(0, 40);

            MessageBox.confirm(oBundle.getText("notesDeleteConfirm", [sMessage]), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: async function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    try {
                        await ContactApi.deleteNote(oNote.id);
                        MessageToast.show(oBundle.getText("notesDeleteSuccess"));
                        await this._loadData();
                    } catch (oError) {
                        // API handles messages
                    }
                }.bind(this)
            });
        },

        onNavBackPress: function () {
            this.onNavBack();
        }
    });
});
