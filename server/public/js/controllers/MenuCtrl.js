angular.module('MenuCtrl', []).controller('MenuController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $rootScope, $location, $mdSidenav, $mdToast, $mdDialog, $sanitize, $mdBottomSheet) {
    $rootScope.shell = $rootScope.shell || {
        sidebarOpen: false,
        sidebarCollapsed: false,
        dropdown: null, // 'search' | 'quick' | 'lang' | 'notifications' | 'user' | null
        search: { q: '' },
        navIndex: [],
        quickActions: [],
        submenus: {}
    };
    $scope.shell = $rootScope.shell;

    function setBodyClass(className, enabled) {
        if (!document || !document.body) return;
        document.body.classList.toggle(className, Boolean(enabled));
    }

    function applyShellClasses() {
        setBodyClass('admx-mobile-sidebar-open', $rootScope.shell.sidebarOpen);
        setBodyClass('admx-sidebar-collapsed', $rootScope.shell.sidebarCollapsed);
    }

    function normalizeText(value) {
        return (value || '').toString().toLowerCase().trim();
    }

    function pushNavItem(list, item, parentLabel) {
        if (!item) return;
        if (item.href) {
            list.push({
                name: item.name || item.label || item.href,
                href: item.href,
                icon: item.icomoon,
                parent: parentLabel || null
            });
        }
        if (Array.isArray(item.items) && item.items.length) {
            var nextParent = item.name || parentLabel;
            for (var j = 0; j < item.items.length; j++) {
                pushNavItem(list, item.items[j], nextParent);
            }
        }
    }

    function buildNavIndex(navGroups) {
        var list = [];
        if (!Array.isArray(navGroups)) return list;
        for (var i = 0; i < navGroups.length; i++) {
            var group = navGroups[i];
            if (!group || !Array.isArray(group.items)) continue;
            for (var k = 0; k < group.items.length; k++) {
                pushNavItem(list, group.items[k], group.header || null);
            }
        }
        return list;
    }

    function buildQuickActions(navIndex) {
        var actions = [];
        var seen = {};
        for (var i = 0; i < navIndex.length; i++) {
            var it = navIndex[i];
            var href = it.href;
            var name = it.name || '';
            if (!href || seen[href]) continue;
            var hay = (name + ' ' + href).toLowerCase();
            if (hay.indexOf('.new') !== -1 || hay.indexOf('.create') !== -1 || hay.indexOf(' new') !== -1 || hay.indexOf('create') !== -1 || hay.indexOf('add') !== -1) {
                seen[href] = true;
                actions.push(it);
            }
        }
        return actions.slice(0, 8);
    }

    function closeDropdowns() {
        $rootScope.shell.dropdown = null;
    }

    function closeSidebar() {
        $rootScope.shell.sidebarOpen = false;
        applyShellClasses();
    }

    function isMobile() {
        return $window && $window.matchMedia && $window.matchMedia('(max-width: 991px)').matches;
    }

    $scope.toggleSidebar = function () {
        $rootScope.shell.sidebarOpen = !$rootScope.shell.sidebarOpen;
        applyShellClasses();
        closeDropdowns();
    };

    $scope.closeSidebar = function () {
        closeSidebar();
    };

    $scope.toggleSidebarCollapse = function () {
        $rootScope.shell.sidebarCollapsed = !$rootScope.shell.sidebarCollapsed;
        applyShellClasses();
    };

    $scope.toggleDropdown = function (name) {
        $rootScope.shell.dropdown = ($rootScope.shell.dropdown === name) ? null : name;
    };

    $scope.isDropdownOpen = function (name) {
        return $rootScope.shell.dropdown === name;
    };

    $scope.closeAllOverlays = function () {
        closeDropdowns();
        closeSidebar();
    };

    $scope.clearSearch = function () {
        $rootScope.shell.search.q = '';
        $rootScope.shell.dropdown = null;
    };

    $scope.searchResults = function () {
        var q = normalizeText($rootScope.shell.search.q);
        if (!q) return [];
        var results = [];
        var pool = $rootScope.shell.navIndex || [];
        for (var i = 0; i < pool.length; i++) {
            var it = pool[i];
            var hay = normalizeText(it.name) + ' ' + normalizeText(it.parent) + ' ' + normalizeText(it.href);
            if (hay.indexOf(q) !== -1) results.push(it);
            if (results.length >= 8) break;
        }
        return results;
    };

    $scope.quickActions = function () {
        return $rootScope.shell.quickActions || [];
    };

    $scope.goTo = function (state) {
        if (!state) return;
        closeDropdowns();
        if (isMobile()) closeSidebar();
        $state.go(state);
    };

    $scope.onNavClick = function () {
        if (isMobile()) closeSidebar();
    };

    $scope.submenuKey = function (item) {
        return normalizeText((item && (item.href || item.sref || item.name)) || 'submenu');
    };

    $scope.isSubmenuOpen = function (item) {
        if (!item || !Array.isArray(item.items) || item.items.length === 0) return false;
        var key = $scope.submenuKey(item);
        if ($rootScope.shell.submenus[key]) return true;
        if (item.href && $state.includes(item.href)) return true;
        for (var i = 0; i < item.items.length; i++) {
            var sub = item.items[i];
            if (sub && sub.href && $state.includes(sub.href)) return true;
        }
        return false;
    };

    $scope.toggleSubmenu = function (item, $event) {
        if ($event && $event.preventDefault) $event.preventDefault();
        if ($event && $event.stopPropagation) $event.stopPropagation();
        var key = $scope.submenuKey(item);
        $rootScope.shell.submenus[key] = !$rootScope.shell.submenus[key];
    };

    $scope.languages = [
        { code: 'en', label: 'EN' },
        { code: 'fr', label: 'FR' },
        { code: 'es', label: 'ES' },
        { code: 'pt', label: 'PT' },
        { code: 'ru', label: 'RU' }
    ];

    $scope.currentLanguage = function () {
        var stored = ($window.localStorage.language || '').toString().toLowerCase();
        return stored || (gettextCatalog.currentLanguage || 'en');
    };

    $scope.setLanguage = function (code) {
        if (!code) return;
        $window.localStorage.language = code.toString().toLowerCase();
        if (gettextCatalog && gettextCatalog.setCurrentLanguage) {
            gettextCatalog.setCurrentLanguage($window.localStorage.language);
        }
        $window.location.reload();
    };

    applyShellClasses();

    $ocLazyLoad.load('js/services/NotificationService.js').then(function () {
        var Notification = $injector.get('Notification');

        $ocLazyLoad.load('js/services/UIService.js').then(function () {
            var UI = $injector.get('UI');

            var helper = {
                title: gettextCatalog.getString("Nothing to report!"),
                icon: "notifications_none"
            };
            $scope.helper = [];
            $scope.pending = 0;

            UI.nav().then(function (response) {
                var data = response.data;
                $scope.nav = data.nav.left;
                $rootScope.shell.navIndex = buildNavIndex($scope.nav);
                $rootScope.shell.quickActions = buildQuickActions($rootScope.shell.navIndex);
            }).catch(function (response) {
                console.log(response);
            });
            
            $scope.activepath = $location.path();

            function getNotifications() {
                $scope.pending = 0;
                Notification.list().then(function (response) {
                    var data = response.data;
                    $scope.helper = [];
                    if (data.length == 0 && $scope.helper.length == 0) {
                        $scope.helper = helper;
                    }
                    for (var i = 0; i < data.length; i++) {
                        if (!data[i].read) {
                            $scope.pending++;
                        }
                    }
                    $scope.notifications = data;
                }).catch(function (response) {
                    console.log(response);
                });
            }
            getNotifications();


            $scope.sohwSedentary = function (position) {

                $ocLazyLoad.load('js/controllers/staffs/staff/SedentaryCtrl.js').then(function () {
                    $mdDialog.show({
                        controller: 'SedentaryController',
                        templateUrl: '../templates/dialogs/sedentary.html',
                        parent: angular.element(document.body),
                        clickOutsideToClose: true,
                        locals: {
                            params: {
                                positionTo: position
                            }
                        }
                    }).then(function (answer) {
                    }, function () {
                    });
                });
            }


            $scope.read = function (notification) {
                if (!notification.read) {
                    Notification.update(notification).then(function () {});
                }

                if (notification.details) {
                    var details = notification.details;
                    $ocLazyLoad.load('js/controllers/staffs/staff/SedentaryCtrl.js').then(function () {
                        $mdDialog.show({
                            controller: 'SedentaryController',
                            templateUrl: '../templates/dialogs/sedentary.html',
                            parent: angular.element(document.body),
                            clickOutsideToClose: true,
                            locals: {
                                params: {
                                    details: details
                                }
                            }
                        }).then(function (answer) {
                        }, function () {
                        });
                    });
                } else {
                    $mdDialog.show(
                            $mdDialog.alert()
                            .clickOutsideToClose(true)
                            .title(notification.author)
                            .htmlContent(notification.content)
                            .ariaLabel(gettextCatalog.getString("Notifications"))
                            .ok(gettextCatalog.getString('Got it!'))
                            ).finally(function () {
                        getNotifications();
                        $scope.toggleNotifications();
                    });
                }
            };

            $rootScope.$on("ERR_CONNECTION_REFUSED", function () {
                if ($rootScope.ERR_CONNECTION_REFUSED) {
                    $rootScope.kernel.alerts.push({
                        type: 1,
                        msg: gettextCatalog.getString('Sygepe Unreachable.'),
                        priority: 1
                    });
                }
            });

            $scope.toggleSidenav = function () {
                return $mdSidenav('left').toggle();
            };

            $scope.toggleNotifications = function () {
                return $mdSidenav('right').toggle();
            };

            $scope.go = function (state) {
                switch (state) {
                    case '#':
                        $scope.signout();
                        break;
                    default:
                        $scope.toggleSidenav();
                        $state.go(state);
                        break;
                }
            };


            //TODO: manage duplicate alerts (with content and date)
            $rootScope.$watch('kernel.alerts', function (newValue, oldValue) {
                if (newValue.length > 0) {
                    var hide = 3000;
                    if (newValue[newValue.length - 1].priority < 3) {
                        hide = 5000;
                    }
                    $mdToast.show(
                            $mdToast.simple()
                            .textContent(newValue[newValue.length - 1].msg)
                            .position('bottom left')
                            .hideDelay(hide)
                            );
                    $rootScope.kernel.alerts.splice(-1, 1);
                }
            }, true);


            $scope.signout = function signout() {
                $ocLazyLoad.load('js/services/AccountService.js').then(function () {
                    var Account = $injector.get('Account');
                    try { $mdSidenav('left').toggle(); } catch (e) {}
                    closeSidebar();
                    if ($window.localStorage.token) {
                        Account.signout().then(function (response) {
                            $rootScope.account = {};
                            delete $window.localStorage.language;
                            delete $window.localStorage.token;
                            delete $window.localStorage.roomToken;
                            closeDropdowns();
                            $state.go("welcome", {}, {reload: true});
                        }).catch(function (response) {
                            console.log(response);
                        });
                    }
                });
            };
        });
    });
});
