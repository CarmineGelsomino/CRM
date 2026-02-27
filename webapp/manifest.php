<?php
session_start();
$isAuthorized = !empty($_SESSION['crm_user']);
header('Content-Type: application/json; charset=utf-8');

$routes = $isAuthorized
    ? [
        ['pattern' => '', 'name' => 'home', 'target' => 'home'],
        ['pattern' => 'login', 'name' => 'login', 'target' => 'login']
    ]
    : [
        ['pattern' => '', 'name' => 'login', 'target' => 'login'],
        ['pattern' => 'home', 'name' => 'home', 'target' => 'home']
    ];

$manifest = [
    '_version' => '1.60.0',
    'sap.app' => [
        'id' => 'crm',
        'type' => 'application',
        'title' => 'CRM OpenUI5',
        'applicationVersion' => ['version' => '1.0.0']
    ],
    'sap.ui5' => [
        'rootView' => [
            'viewName' => 'crm.view.App',
            'type' => 'XML',
            'id' => 'app'
        ],
        'dependencies' => [
            'minUI5Version' => '1.120.0',
            'libs' => [
                'sap.m' => new stdClass(),
                'sap.ui.core' => new stdClass(),
                'sap.ui.layout' => new stdClass()
            ]
        ],
        'models' => [
            'i18n' => [
                'type' => 'sap.ui.model.resource.ResourceModel',
                'settings' => [
                    'bundleName' => 'crm.i18n.i18n'
                ]
            ]
        ],
        'routing' => [
            'config' => [
                'routerClass' => 'sap.m.routing.Router',
                'viewType' => 'XML',
                'viewPath' => 'crm.view',
                'controlId' => 'appNavContainer',
                'controlAggregation' => 'pages',
                'async' => true,
                'bypassed' => ['target' => 'login']
            ],
            'routes' => $routes,
            'targets' => [
                'login' => [
                    'viewName' => 'Login',
                    'viewId' => 'login'
                ],
                'home' => [
                    'viewName' => 'Home',
                    'viewId' => 'home'
                ]
            ]
        ]
    ]
];

echo json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
