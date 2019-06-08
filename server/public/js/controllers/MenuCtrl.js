angular.module('MenuCtrl', []).controller('MenuController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $rootScope, $mdSidenav, $mdToast, $mdDialog, $sanitize, $mdBottomSheet) {
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

                $scope.nav = [];
                for (var i = 0; i < data.nav.left.length; i++) {
                    data.nav.left[i].header = gettextCatalog.getString(data.nav.left[i].header);
                    for (var j = 0; j < data.nav.left[i].items.length; j++) {
                        data.nav.left[i].items[j].name = gettextCatalog.getString(data.nav.left[i].items[j].name);
                    }
                }
                $scope.nav = data.nav.left;
            }).catch(function (response) {
                console.log(response);
            });

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


            $scope.read = function (notification) {
                if (!notification.read) {
                    Notification.update(notification).then(function () {});
                }
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
                    $mdSidenav('left').toggle();
                    if ($window.localStorage.token) {
                        Account.signout().then(function (response) {
                            $rootScope.account = {};
                            delete $window.localStorage.language;
                            delete $window.localStorage.token;
                            delete $window.localStorage.roomToken;
                            $state.go("signin", {}, {reload: true});
                        }).catch(function (response) {
                            console.log(response);
                        });
                    }
                });
            };
        });
    });
});