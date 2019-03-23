angular.module('OrganizationCtrl', []).controller('OrganizationController', function($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";

    $scope.typesList = [
        {name:'Community', value:'1'},
        {name:'Developed country NGO', value:'2'},
        {name:'Developing country NGO', value:'3'},
        {name:'Donors', value:'4'},
        {name:'Foundation', value:'5'},
        {name:'Private sector', value:'6'},
        {name:'Technical agency', value:'7'},
        {name:'Government', value:'8'},
        {name:'Funder', value:'9'},
        {name:'Research Consortium', value:'10'}
    ];

    $scope.myFilter = function (item) { 
        return item.selected; 
    };

    $ocLazyLoad.load('js/services/UserService.js').then(function() {
        var User = $injector.get('User');
        User.list().then(function(response){
            $scope.users = response.data;
            $ocLazyLoad.load('js/services/OrganizationService.js').then(function() {
                var Organization = $injector.get('Organization');
                $rootScope.kernel.loading = 100;

                // Modify or Add ?
                if($stateParams.id !== undefined){
                    $scope.new = false; 
                    Organization.read({
                        id : $stateParams.id
                    }).then(function(response){
                        $scope.organization = response.data;
                    }).catch(function(response) {
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                        console.error(response);
                    });

                    // Modify an Organization
                    $scope.submit = function(){   
                        $rootScope.kernel.loading = 0;
                        Organization.upsert(
                            $scope.organization
                        ).then(function(response){
                            $state.transitionTo('home.organizations.main');
                            $rootScope.kernel.alerts.push({
                                type: 3,
                                msg: gettextCatalog.getString('The organization has been updated'),
                                priority: 4
                            });
                            $rootScope.kernel.loading = 100;
                        }).catch(function(response) {
                            $rootScope.kernel.loading = 100;
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                priority: 2
                            });
                            console.error(response);
                        });
                    }
                } else {
                    $scope.new = true;
                    $scope.title = gettextCatalog.getString('New');

                    // Prefill if duplicate
                    if($stateParams.duplicateID){
                        Organization.read({
                            id : $stateParams.duplicateID
                        }).then(function(response){
                            $scope.organization = {
                                name: response.data.name + " 2",
                                type: response.data.type
                            }
                        }).catch(function(response) {
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                priority: 2
                            });
                            console.error(response);
                        });
                    }

                    // Add a new organization
                    $scope.submit = function(){
                        $scope.loading = 0;
                        Organization.upsert(
                            $scope.organization
                        ).then(function(response){
                            $scope.loading = 100;
                            $state.transitionTo('home.organizations.main');
                            $rootScope.kernel.alerts.push({
                                type:3,
                                msg: gettextCatalog.getString('The organization has been created'),
                                priority: 4
                            });
                        }).catch(function(response) {
                            $scope.loading = 100;
                            console.error(response);
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                priority: 2
                            });
                        });
                    }
                }
            });
        }).catch(function(response) {
            console.error(response);
        });
    });
});
