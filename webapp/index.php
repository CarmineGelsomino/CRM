<?php
session_start();
$isAuthorized = !empty($_SESSION['crm_user']);
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRM OpenUI5</title>
    <script>
        window.CRM_CONFIG = {
            authorized: <?php echo $isAuthorized ? 'true' : 'false'; ?>,
            manifestUrl: "manifest.php",
            apiBaseUrl: "../api"
        };
    </script>
    <script
        id="sap-ui-bootstrap"
        src="https://sdk.openui5.org/resources/sap-ui-core.js"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-libs="sap.m,sap.ui.layout"
        data-sap-ui-compatVersion="edge"
        data-sap-ui-async="true"
        data-sap-ui-oninit="module:crm/bootstrap"
        data-sap-ui-resourceroots='{"crm": "./"}'>
    </script>
</head>
<body class="sapUiBody sapUiSizeCompact" id="content"></body>
</html>
