angular.module('ResetCtrl', []).controller('ResetController', function($scope, gettextCatalog, $ocLazyLoad, $injector, $stateParams, $state, $mdToast) {
    $ocLazyLoad.load('js/services/AccountService.js').then(function() {
        $scope.loading = false;
        var Account = $injector.get('Account');

        $scope.darkMode = localStorage.getItem('darkMode') === 'true';
        if ($scope.darkMode) document.body.classList.add('dark-mode');
        $scope.toggleDarkMode = function() {
            $scope.darkMode = !$scope.darkMode;
            localStorage.setItem('darkMode', $scope.darkMode);
            if ($scope.darkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        };
        $scope.showPassword = false;
        $scope.showConfirm = false;
        $scope.passwordStrength = 0;
        $scope.passwordStrengthLabel = '';
        $scope.passwordsMatch = true;
        $scope.checkStrength = function() {
            var pwd = $scope.newPassword || '';
            var score = 0;
            if (pwd.length >= 6) score += 30;
            if (/[A-Z]/.test(pwd)) score += 20;
            if (/[0-9]/.test(pwd)) score += 20;
            if (/[^A-Za-z0-9]/.test(pwd)) score += 30;
            $scope.passwordStrength = score;
            if (score < 40) $scope.passwordStrengthLabel = gettextCatalog.getString('Weak');
            else if (score < 70) $scope.passwordStrengthLabel = gettextCatalog.getString('Medium');
            else $scope.passwordStrengthLabel = gettextCatalog.getString('Strong');
        };
        $scope.checkMatch = function() {
            $scope.passwordsMatch = $scope.newPassword === $scope.newPasswordConfirmation;
        };
        $scope.$watchGroup(['newPassword', 'newPasswordConfirmation'], function() {
            $scope.checkStrength();
            $scope.checkMatch();
        });

        $scope.submit = function() {
            if (!$scope.newPassword || !$scope.newPasswordConfirmation) {
                $mdToast.show(
                    $mdToast.simple()
                    .textContent(gettextCatalog.getString('Please fill in both password fields.'))
                    .position('top left right')
                    .hideDelay(3000)
                );
                return;
            }
            if (!$scope.passwordsMatch) {
                $mdToast.show(
                    $mdToast.simple()
                    .textContent(gettextCatalog.getString('Passwords do not match.'))
                    .position('top left right')
                    .hideDelay(3000)
                );
                return;
            }
            if ($scope.passwordStrength < 60) {
                $mdToast.show(
                    $mdToast.simple()
                    .textContent(gettextCatalog.getString('Password is too weak.'))
                    .position('top left right')
                    .hideDelay(3000)
                );
                return;
            }
            $scope.loading = true;
            Account.resetPassword({
                token: $stateParams.token,
                newPassword: $scope.newPassword,
                newPasswordConfirmation: $scope.newPasswordConfirmation
            }).then(function(response) {
                var data = response.data;
                $scope.loading = false;
                $scope.newPassword = '';
                $scope.newPasswordConfirmation = '';
                $scope.showPassword = false;
                $scope.showConfirm = false;
                if(!data.token){
                    $mdToast.show(
                        $mdToast.simple()
                        .textContent(gettextCatalog.getString('The link has expired'))
                        .position('top left right')
                        .hideDelay(3000)
                    );
                } else {
                    if(!data.changed){
                        $mdToast.show(
                            $mdToast.simple()
                            .textContent(gettextCatalog.getString('Fill out the form correctly'))
                            .position('top left right')
                            .hideDelay(3000)
                        );
                    } else {
                        $state.go("signin", {"isResetted": true, "email": data.email});
                    }
                }
            }).catch(function(response) {
                $scope.newPassword = '';
                $scope.newPasswordConfirmation = '';
                $scope.loading = false;
                $scope.showPassword = false;
                $scope.showConfirm = false;
                $mdToast.show(
                    $mdToast.simple()
                    .textContent(gettextCatalog.getString('A server error occurred. Please try again.'))
                    .position('top left right')
                    .hideDelay(3000)
                );
            });
        }
    });
});
