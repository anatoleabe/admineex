angular.module('StaffCtrl', []).controller('StaffController', function ($scope, $window, gettextCatalog, $stateParams, $state, $q, $ocLazyLoad, $injector, $rootScope, $location, $filter) {


    $rootScope.kernel.loading = 0;
    var currentId = ($location && $location.search() && $location.search().id) ? $location.search().id : undefined;
    $scope.title = "...";
    $scope.personnel = {
        name: {
            use: "",
            family: [],
            middle: [],
            given: []
        },
        telecom: [{
                "use": "home",
                "system": "phone"
            }, {
                "system": "email"
            }, {
                personToContact: undefined
            }],
        cni: {},
        more: {},
        qualifications: {
            schools: [{type: "higher"}, {type: "recrutement"}],
            stages: []
        },
        sanctions: [],
        situations: [],
        trainnings: [],
        notations: [],
        profiles: [],
        skills: [],
        history: {
            positions: []
        },
        address: [{
                country: "CMR",
                region: undefined,
                department: undefined,
                arrondissement: undefined,
                use: "home"
            }
        ]
    };
    var firstTime = true;

    $scope.gradeActuel = undefined;

    $scope.loading = false;
    $scope.sending = false;
    $scope.regions = [];
    $scope.divisions = [];
    $scope.stages = [{title: '', from: undefined, to: undefined, authority: ''}];
    $scope.previousFonctions = [{numAct: '', nature: '', from: undefined}];
    $scope.familySituations = [{
            "id": "single",
            value: gettextCatalog.getString('Single')
        }, {
            "id": "maried",
            value: gettextCatalog.getString('Maried')
        }, {
            "id": "divorced",
            value: gettextCatalog.getString('Divorced')
        }];
    $scope.grades = [];
    $scope.categories = [];
    $scope.personnels = [];
    $scope.corps = [];
    $scope.allYears = [];
    $scope.stageCounter = 1;

    $scope.showBusyText = false;
    $scope.stepData = [
        {step: 1, completed: false, optional: false, data: {}},
        {step: 2, completed: false, optional: false, data: {}},
        {step: 3, completed: false, optional: false, data: {}},
    ];

    $scope.enableNextStep = function nextStep() {
        //do not exceed into max step
        if ($scope.selectedStep >= $scope.maxStep) {
            return;
        }
        //do not increment $scope.stepProgress when submitting from previously completed step
        if ($scope.selectedStep === $scope.stepProgress - 1) {
            $scope.stepProgress = $scope.stepProgress + 1;
        }
        $scope.selectedStep = $scope.selectedStep + 1;
    }

    $scope.moveToPreviousStep = function moveToPreviousStep() {
        if ($scope.selectedStep > 0) {
            $scope.selectedStep = $scope.selectedStep - 1;
        }
    }

    $scope.submitCurrentStep = function submitCurrentStep(stepData, isSkip) {
        var deferred = $q.defer();
        if (!stepData.completed && !isSkip) {
            //move to next step when success
            stepData.completed = true;
            $scope.enableNextStep();
        } else {
            $scope.showBusyText = false;
            $scope.enableNextStep();
        }
    }


    $scope.addNewStageLine = function () {
        $scope.stages.push({title: '', start: undefined, end: undefined, authority: ''});
    }

    $scope.removeStageLine = function (index) {
        $scope.stages.splice(index, 1);
    }

    $scope.addNewPreviousFonctionsLine = function () {
        $scope.previousFonctions.push({numAct: '', nature: '', from: undefined});
    }

    $scope.removePreviousFonctionsLine = function (index) {
        $scope.previousFonctions.splice(index, 1);
    }


    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staff = $injector.get('Staff');
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');

            Dictionary.jsonList({dictionary: 'structure', levels: ['types']}).then(function (response) {
                $scope.types = response.data.jsonList;
                Dictionary.jsonList({dictionary: 'structure', levels: ['ranks']}).then(function (response) {
                    $scope.ranks = response.data.jsonList;
                    Dictionary.jsonList({dictionary: 'personnel', levels: ['status']}).then(function (response) {
                        $scope.status = response.data.jsonList;
                        Dictionary.jsonList({dictionary: 'acts', levels: ['natures']}).then(function (response) {
                            $scope.natures = response.data.jsonList;
                            Dictionary.jsonList({dictionary: 'personnel', levels: ['educationLevels']}).then(function (response) {
                                $scope.educationLevels = response.data.jsonList;

                                Dictionary.jsonList({dictionary: 'location', levels: ['countries', 'CMR']}).then(function (response) {
                                    var data = response.data;
                                    $rootScope.kernel.loading = 100;
                                    $scope.regions = data.jsonList;
                                    if (!firstTime === true) {
                                        $scope.departments = [];
                                        $scope.personnel.address[0].country = "CMR";
                                        $scope.personnel.address[0].department = undefined;
                                        $scope.personnel.address[0].arrondissement = undefined;
                                    } else {
                                        firstTime = false;
                                    }

                                }).catch(function (response) {
                                    console.error(response);
                                });

                                var watch = {};
                                watch.region = $scope.$watch('personnel.address[0].region', function (newval, oldval) {
                                    if (newval) {
                                        Dictionary.jsonList({dictionary: 'location', levels: ['countries', "regions", newval]}).then(function (response) {
                                            var data = response.data;
                                            $rootScope.kernel.loading = 100;
                                            $scope.departments = data.jsonList;

                                            if (oldval) {
                                                if (newval !== oldval) {
                                                    $scope.personnel.address[0].arrondissement = undefined;
                                                }
                                            } else {
                                                if (!$scope.personnel.address[0].arrondissement) {
                                                    $scope.personnel.address[0].arrondissement = undefined;
                                                }
                                            }

                                        }).catch(function (response) {
                                            console.error(response);
                                        });
                                    } else {
                                        $scope.personnel.address[0].arrondissement = undefined;
                                    }
                                });
                                
                                watch.region = $scope.$watch('personnel.address[0].department', function (newval, oldval) {
                                    if (newval) {
                                        Dictionary.jsonList({dictionary: 'location', levels: ['countries', "regions", $scope.personnel.address[0].region, newval]}).then(function (response) {
                                            var data = response.data;
                                            $rootScope.kernel.loading = 100;
                                            $scope.arrondissements = data.jsonList;

                                            if (oldval) {
                                                if (newval !== oldval) {
                                                    $scope.personnel.address[0].arrondissement = undefined;
                                                }
                                            } else {
                                                if (!$scope.personnel.address[0].arrondissement) {
                                                    $scope.personnel.address[0].arrondissement = undefined;
                                                }
                                            }

                                        }).catch(function (response) {
                                            console.error(response);
                                        });
                                    } else {
                                        $scope.personnel.address[0].arrondissement = undefined;
                                    }
                                });

                                watch.status = $scope.$watch('personnel.status', function (newval, oldval) {
                                    if (newval) {
                                        Dictionary.jsonList({dictionary: 'personnel', levels: ['status', newval, "corps"]}).then(function (response) {
                                            $scope.corps = response.data.jsonList;
                                        });
                                        if ($stateParams.id === undefined) {
                                            $scope.personnel.corps = undefined;
                                            $scope.personnel.grade = undefined;
                                            $scope.personnel.category = undefined;
                                        }
                                    } else {
                                        $scope.corps = [];
                                        $scope.grades = [];
                                        $scope.categories = [];
                                        $scope.personnel.corps = undefined;
                                        $scope.personnel.grade = undefined;
                                        $scope.personnel.category = undefined;
                                    }
                                });

                                watch.grades = $scope.$watch('personnel.corps', function (newval, oldval) {
                                    if (newval) {
                                        Dictionary.jsonList({dictionary: 'personnel', levels: ['status', $scope.personnel.status, "grades"]}).then(function (response) {
                                            $scope.grades = response.data.jsonList;
                                        });
                                        if ($stateParams.id === undefined) {
                                            $scope.personnel.grade = undefined;
                                            $scope.personnel.category = undefined;
                                        }
                                    } else {
                                        $scope.grades = [];
                                        $scope.categories = [];
                                        $scope.personnel.grade = undefined;
                                        $scope.personnel.category = undefined;
                                    }
                                });

                                watch.categories = $scope.$watch('personnel.grade', function (newval, oldval) {
                                    if (newval) {

                                        Dictionary.jsonList({dictionary: 'personnel', levels: ['status', $scope.personnel.status, "categories"]}).then(function (response) {
                                            $scope.categories = response.data.jsonList;
                                        });

                                        if ($stateParams.id === undefined) {
                                            $scope.personnel.category = undefined;
                                        }
                                    } else {
                                        $scope.categories = [];
                                        $scope.personnel.category = undefined;
                                    }
                                });

                                $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                                    watch.region();
                                    watch.status();
                                    watch.categories();
                                    watch.grades();
                                });

                                function prepareForAngular() {
                                    if ($scope.personnel && $scope.personnel.qualifications) {
                                        $scope.stages = $scope.personnel.qualifications.stages;
                                        if (($scope.stages && $scope.stages.length == 0) || !$scope.stages) {
                                            $scope.stages = [{title: '', from: undefined, to: undefined, authority: ''}];
                                        }
                                    }
                                    if ($scope.personnel && $scope.personnel.qualifications) {
                                        $scope.stages = $scope.personnel.qualifications.stages;
                                        if (($scope.stages && $scope.stages.length == 0) || !$scope.stages) {
                                            $scope.stages = [{title: '', from: undefined, to: undefined, authority: ''}];
                                        }
                                    }
                                }

                                function prepareForServer() {
                                    if ($scope.personnel && $scope.personnel.qualifications) {
                                        $scope.personnel.qualifications.stages = [];
                                        for (var i = 0; i <= $scope.stages.length; i++) {
                                            if ($scope.stages[i] && $scope.stages[i].title && $scope.stages[i].title != "") {
                                                $scope.personnel.qualifications.stages.push($scope.stages[i])
                                            }
                                        }
                                    }
                                }

                                // Add or edit new Personnel
                                $scope.checkIfMatriculeExist = function () {
                                    Staff.checkExistance({
                                        mat: $scope.personnel.identifier
                                    }).then(function (response) {
                                        if (response.data > 0 && !$scope.personnel._id) {
                                            $rootScope.kernel.alerts.push({
                                                type: 1,
                                                msg: gettextCatalog.getString('Error:  this Register Number already exist.'),
                                                priority: 2
                                            });
                                        }
                                    }).catch(function (response) {
                                        $rootScope.kernel.alerts.push({
                                            type: 1,
                                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                                            priority: 2
                                        });
                                        console.error(response);
                                    });
                                }

                                //Modify or Add ?
                                if ($stateParams.id !== undefined) {
                                    $scope.new = false;
                                    Staff.read({
                                        id: $stateParams.id
                                    }).then(function (response) {
                                        $scope.personnel = response.data;
                                        prepareForAngular();
                                    }).catch(function (response) {
                                        $rootScope.kernel.alerts.push({
                                            type: 1,
                                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                                            priority: 2
                                        });
                                        console.error(response);
                                    });
                                } else {
                                    $scope.new = true;
                                    $scope.title = gettextCatalog.getString('New');
                                }

                                // Add or edit new Personnel
                                $scope.submit = function () {
                                    Staff.checkExistance({
                                        mat: $scope.personnel.identifier
                                    }).then(function (response) {
                                        if (response.data > 0 && !$scope.personnel._id) {
                                            $rootScope.kernel.alerts.push({
                                                type: 1,
                                                msg: gettextCatalog.getString('Error:  this Register Number already exist.'),
                                                priority: 2
                                            });
                                        } else {
                                            $rootScope.kernel.loading = 0;
                                            prepareForServer();
                                            console.log($scope.personnel);
                                            Staff.upsert($scope.personnel).then(function (response) {
                                                $rootScope.kernel.loading = 100;
                                                $state.go('home.staffs.main');
                                                $rootScope.kernel.alerts.push({
                                                    type: 3,
                                                    msg: gettextCatalog.getString('The personnel has been saved'),
                                                    priority: 4
                                                });
                                            }).catch(function (response) {
                                                $rootScope.kernel.loading = 100;
                                                $rootScope.kernel.alerts.push({
                                                    type: 1,
                                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                    priority: 2
                                                });
                                                console.error(response);
                                            });
                                        }
                                    }).catch(function (response) {
                                        $rootScope.kernel.alerts.push({
                                            type: 1,
                                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                                            priority: 2
                                        });
                                        console.error(response);
                                    });
                                }
                            });
                        });
                    });
                });
            });
        });
    });
});
