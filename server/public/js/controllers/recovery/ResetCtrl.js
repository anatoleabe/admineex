angular.module('ResetCtrl', []).controller('ResetController', function($scope, gettextCatalog, $ocLazyLoad, $injector, $stateParams, $state, $mdToast) {
    $scope.loading = false;
    $scope.showPassword = false;
    $scope.currentYear = new Date().getFullYear();
    $scope.resetError = null;
    $scope.resetSuccess = null;
    
    $ocLazyLoad.load('js/services/AccountService.js').then(function() {
        var Account = $injector.get('Account');
        
        if (!$stateParams.token) {
            $scope.resetError = gettextCatalog.getString('Lien de réinitialisation invalide ou expiré.');
        }
        
        $scope.submit = function() {
            if (!$scope.resetForm.$valid) {
                angular.forEach($scope.resetForm.$error.required, function(field) {
                    field.$setTouched();
                });
                return;
            }
            
            if ($scope.newPassword !== $scope.newPasswordConfirmation) {
                $scope.resetError = gettextCatalog.getString('Les mots de passe ne correspondent pas.');
                return;
            }
            
            $scope.loading = true;
            $scope.resetError = null;
            
            Account.resetPassword({
                token: $stateParams.token,
                newPassword: $scope.newPassword,
                newPasswordConfirmation: $scope.newPasswordConfirmation
            }).then(function(response) {
                var data = response.data;
                $scope.loading = false;
                
                if(!data.token){
                    $scope.newPassword = "";
                    $scope.newPasswordConfirmation = "";
                    $scope.resetError = gettextCatalog.getString('Le lien de réinitialisation a expiré ou est invalide.');
                } else {
                    if(!data.changed){
                        $scope.newPassword = "";
                        $scope.newPasswordConfirmation = "";
                        $scope.resetError = gettextCatalog.getString('Veuillez remplir correctement le formulaire.');
                    } else {
                        $scope.resetSuccess = gettextCatalog.getString('Votre mot de passe a été réinitialisé avec succès.');
                        setTimeout(function() {
                            $state.go("signin", {"isResetted": true, "email": data.email});
                        }, 2000);
                    }
                }
            }).catch(function(response) {
                $scope.loading = false;
                $scope.newPassword = "";
                $scope.newPasswordConfirmation = "";
                $scope.resetError = gettextCatalog.getString('Une erreur s\'est produite, veuillez réessayer plus tard.');
            });
        };
        
        $scope.handleKeyPress = function(event) {
            if (event.keyCode === 13 && !$scope.loading) {
                $scope.submit();
            }
        };
    });
});
