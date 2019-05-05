angular.module('ProjectCtrl', []).controller('ProjectController', function($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";

    $scope.statusesList = [
        {name:gettextCatalog.getString('In talks'), value:'1'},
        {name:gettextCatalog.getString('Proposal Sent'), value:'2'},
        {name:gettextCatalog.getString('Accepted'), value:'3'},
        {name:gettextCatalog.getString('Signed'), value:'4'},
        {name:gettextCatalog.getString('Completed'), value:'5'},
        {name:gettextCatalog.getString('Canceled'), value:'6'}
    ];
    $scope.revenueTypesList = [
        {name:'One Shot Sales', value:'1'},
        {name:'Recurring Sales', value:'2'},
        {name:'Subsidy', value:'3'},
        {name:'Service', value:'4'}
    ];
    $scope.sicknessesList = [
        {name:gettextCatalog.getString('- Generic -'), value:'0'},
        {name:gettextCatalog.getString('TB'), value:'1'},
        {name:gettextCatalog.getString('HIV'), value:'2'},
        {name:gettextCatalog.getString('Ebola'), value:'3'},
        {name:gettextCatalog.getString('Malaria'), value:'4'},
        {name:gettextCatalog.getString('HCV'), value:'5'}
    ];
    $scope.productsList = [
        {name:gettextCatalog.getString('DataToCare'), value:'1'},
        {name:gettextCatalog.getString('MediScout'), value:'2'},
        {name:gettextCatalog.getString('Selfics'), value:'3'},
        {name:gettextCatalog.getString('Alics'), value:'4'}
    ];

    $scope.myFilter = function (item) { 
        return item.selected; 
    };
    
    $scope.onSicknessesChange = function () { 
        if($scope.project.context.sicknesses.indexOf('0') > -1){
           $scope.project.context.sicknesses = ['0'];
        }
    };
    $scope.onStatusChange = function () { 
        if($scope.project.status === '6'){
           $scope.project.successProbability = 0;
        }
    };

    $ocLazyLoad.load('js/services/DictionaryService.js').then(function() {
        var Dictionary = $injector.get('Dictionary');
        Dictionary.jsonList({dictionary: 'project', levels: ['countries']}).then(function (response) {
            console.log(response);
            $scope.countriesList = response.data.jsonList;
            $ocLazyLoad.load('js/services/UserService.js').then(function() {
                var User = $injector.get('User');
                User.list().then(function(response){
                    $scope.users = response.data;
                    $ocLazyLoad.load('js/services/OrganizationService.js').then(function() {
                        var Organization = $injector.get('Organization');
                        Organization.list().then(function(response){
                            $scope.organizations = response.data;
                            $ocLazyLoad.load('js/services/ProjectService.js').then(function() {
                                var Project = $injector.get('Project');
                                $rootScope.kernel.loading = 100;

                                // Modify or Add ?
                                if($stateParams.id !== undefined){
                                    $scope.new = false; 
                                    Project.read({
                                        id : $stateParams.id,
                                        beautify: $state.$current.name.indexOf("profile")>-1 ? true : undefined
                                    }).then(function(response){
                                        response.data.successProbability = parseInt(response.data.successProbability);
                                        response.data.value = parseInt(response.data.value);
                                        $scope.project = response.data;
                                    }).catch(function(response) {
                                        $rootScope.kernel.alerts.push({
                                            type: 1,
                                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                                            priority: 2
                                        });
                                        console.error(response);
                                    });

                                    // Modify a Project
                                    $scope.submit = function(){   
                                        $rootScope.kernel.loading = 0;
                                        Project.upsert(
                                            $scope.project
                                        ).then(function(response){
                                            $state.transitionTo('home.projects.main');
                                            $rootScope.kernel.alerts.push({
                                                type: 3,
                                                msg: gettextCatalog.getString('The project has been updated'),
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
                                        Project.read({
                                            id : $stateParams.duplicateID
                                        }).then(function(response){
                                            $scope.project = {
                                                name: response.data.name + " 2",
                                                enablersID: response.data.enablersID,
                                                value: parseInt(response.data.value),
                                                paymentDate: response.data.paymentDate,
                                                successProbability: parseInt(response.data.successProbability),
                                                status: response.data.status,
                                                finance:response.data.finance,
                                                context:response.data.context
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

                                    // Add a new project
                                    $scope.submit = function(){
                                        $scope.loading = 0;
                                        Project.upsert(
                                            $scope.project
                                        ).then(function(response){
                                            $scope.loading = 100;
                                            $state.transitionTo('home.projects.main');
                                            $rootScope.kernel.alerts.push({
                                                type:3,
                                                msg: gettextCatalog.getString('The project has been created'),
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
                }).catch(function(response) {
                    console.error(response);
                });
            });
        }).catch(function(response) {
            console.error(response);
        });
    });
});
