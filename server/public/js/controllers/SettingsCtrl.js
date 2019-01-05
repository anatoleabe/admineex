angular.module('SettingsCtrl', []).controller('SettingsController', function ($scope, $state, $window, $mdDialog, gettextCatalog, $timeout, $ocLazyLoad, $injector, $rootScope, $location) {
    $scope.off = gettextCatalog.getString("OFF");
    $scope.on = gettextCatalog.getString("ON");
    $ocLazyLoad.load('js/services/UIService.js').then(function () {
        var UI = $injector.get('UI');
        $ocLazyLoad.load('js/services/AccountService.js').then(function () {
            var Account = $injector.get('Account');
            $scope.cards = [];
            $scope.languagesList = [
                {name: 'English', value: 'EN'},
                {name: 'Español', value: 'ES'},
                {name: 'Français', value: 'FR'},
                {name: 'Português', value: 'PT'},
                {name: 'Русский', value: 'RU'}
            ];
            $rootScope.kernel.loading = 100;
            $scope.profile = {language: $window.localStorage.language};
            $scope.oldPassword = "";
            $scope.newPassword = "";
            $scope.newPasswordConfirmation = "";
            $scope.colorsList = ['#bebebe', '#E91E63', '#9C27B0', '#00BCD4', '#CDDC39', '#FFC107'];

            //Get user profile
            Account.read().then(function (response) {
                var data = response.data;
                if (data.preferences && data.preferences.avatar) {
                    $scope.color = data.preferences.avatar;
                } else {
                    $scope.color = $scope.colorsList[0];
                }
                $scope.profile = data;
            }).catch(function (response) {
                console.log(response);
            });


            $scope.selectColor = function (color) {
                $scope.color = color;
            };

            $scope.updateAvatar = function () {
                Account.update({
                    avatar: $scope.color
                }).then(function (response) {
                    $state.go("home.settings.main", {}, {reload: true});
                }).catch(function (response) {
                    console.log(response);
                });
            };


            $scope.changeLanguage = function () {
                Account.update({
                    language: $scope.profile.language,
                }).then(function (response) {
                    $window.localStorage.language = $scope.profile.language;
                    $state.go("home.settings.main", {}, {reload: true});
                }).catch(function (response) {
                    console.log(response);
                });
            };

            $scope.changeNotification = function () {
                Account.update({
                    notification: $scope.profile.preferences.notification
                }).then(function (response) {
                    $state.go("home.settings.main");
                }).catch(function (response) {
                    console.log(response);
                });
            };

            $scope.changePassword = function () {
                if ($scope.newPassword === $scope.newPasswordConfirmation && $scope.newPassword.length >= 6) {
                    Account.changePassword({
                        oldPassword: $scope.oldPassword,
                        newPassword: $scope.newPassword,
                        newPasswordConfirmation: $scope.newPasswordConfirmation
                    }).then(function (response) {
                        var data = response.data;
                        if (!data.new) {
                            $scope.oldPassword = "";
                            $scope.newPassword = "";
                            $scope.newPasswordConfirmation = "";
                            $rootScope.kernel.alerts.push({
                                type: 2,
                                msg: gettextCatalog.getString("These passwords don't match"),
                                priority: 3
                            });
                        } else {
                            if (!data.old) {
                                $scope.oldPassword = "";
                                $scope.newPassword = "";
                                $scope.newPasswordConfirmation = "";
                                $rootScope.kernel.alerts.push({
                                    type: 2,
                                    msg: gettextCatalog.getString("The current password you entered is incorrect"),
                                    priority: 3
                                });
                            } else {
                                $scope.oldPassword = "";
                                $scope.newPassword = "";
                                $scope.newPasswordConfirmation = "";
                                $state.go("home.settings.main");
                                $rootScope.kernel.alerts.push({
                                    type: 3,
                                    msg: gettextCatalog.getString("Your password has been changed"),
                                    priority: 5
                                });
                            }
                        }
                    }).catch(function (response) {
                        console.log("error password");
                    });
                } else {
                    if ($scope.newPassword.length < 6 || $scope.newPasswordConfirmation.length < 6) {
                        $rootScope.kernel.alerts.push({
                            type: 2,
                            msg: gettextCatalog.getString("Use at least 6 characters for your password"),
                            priority: 3
                        });
                        $scope.newPassword = "";
                        $scope.newPasswordConfirmation = "";
                    } else if ($scope.newPassword !== $scope.newPasswordConfirmation) {
                        $rootScope.kernel.alerts.push({
                            type: 2,
                            msg: gettextCatalog.getString("Passwords don't match."),
                            priority: 3
                        });
                        $scope.newPassword = "";
                        $scope.newPasswordConfirmation = "";
                    } else {
                        $scope.oldPassword = "";
                        $scope.newPassword = "";
                        $scope.newPasswordConfirmation = "";
                        $rootScope.kernel.alerts.push({
                            type: 2,
                            msg: gettextCatalog.getString("Fill out the form correctly"),
                            priority: 3
                        });
                    }
                }
            };
        });
    });
});
