angular.module('PersonnalRecordsCtrl', [[
        'node_modules/angular-timeline/dist/angular-timeline.css'
    ]]).controller('PersonnalRecordsController', function ($scope, $window, gettextCatalog, $q, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, $mdDialog, $http, $filter, params) {
    var id = params && params.id ? params.id : $stateParams.id;
    var oldPath = params && params.opath ? params.name : $stateParams.opath;

    $rootScope.kernel.loading = 100;
    $scope.title = "...";

    $scope.loading = false;
    $scope.sending = false;
    $scope.search = false;

    $scope.personnels = [];
    $scope.personnelSelected = undefined;
    $scope.personnelSearchText = null;
    $scope.selectedPersonnelChange = null;
    $scope.profiles = [];
    $scope.kills = [];
    var dictionary = {};
    $scope.helperNoData = {
        icon: 'event_note',
        title: gettextCatalog.getString("No data found.")
    };


    // Initialize bonus tab variables
    $scope.bonusPeriodType = 'predefined';
    $scope.selectedBonusPeriod = 'current-year';
    $scope.loadingBonusData = false;
    $scope.bonusData = [];
    $scope.bonusSummary = {
        count: 0,
        totalGross: 0,
        totalTax: 0,
        totalNet: 0
    };
    $scope.bonusDateRange = {
        from: new Date(new Date().getFullYear(), 0, 1), // Start of current year
        to: new Date()
    };

    // Update bonus tab variables
    $scope.bonusStatusFilter = 'paid'; // Default to 'paid'

    // Add a function to handle status filter changes
    $scope.updateBonusStatusFilter = function(status) {
        $scope.bonusStatusFilter = status;
        $scope.loadBonusData();
    };

    // Predefined periods for bonus selection
    $scope.predefinedBonusPeriods = [
        { value: 'current-year', label: gettextCatalog.getString('Current Year') },
        { value: 'previous-year', label: gettextCatalog.getString('Previous Year') },
        { value: 'last-2-years', label: gettextCatalog.getString('Last 2 Years') },
        { value: 'last-3-years', label: gettextCatalog.getString('Last 3 Years') },
        { value: 'all-time', label: gettextCatalog.getString('All Time') }
    ];

    // Update date range based on predefined period selection
    $scope.updateBonusPeriodSelection = function() {
        if ($scope.bonusPeriodType === 'predefined') {
            var currentDate = new Date();
            var currentYear = currentDate.getFullYear();

            switch($scope.selectedBonusPeriod) {
                case 'current-year':
                    $scope.bonusDateRange.from = new Date(currentYear, 0, 1);
                    $scope.bonusDateRange.to = new Date();
                    break;
                case 'previous-year':
                    $scope.bonusDateRange.from = new Date(currentYear - 1, 0, 1);
                    $scope.bonusDateRange.to = new Date(currentYear - 1, 11, 31);
                    break;
                case 'last-2-years':
                    $scope.bonusDateRange.from = new Date(currentYear - 2, 0, 1);
                    $scope.bonusDateRange.to = new Date();
                    break;
                case 'last-3-years':
                    $scope.bonusDateRange.from = new Date(currentYear - 3, 0, 1);
                    $scope.bonusDateRange.to = new Date();
                    break;
                case 'all-time':
                    $scope.bonusDateRange.from = new Date(2000, 0, 1); // Far back enough to include all records
                    $scope.bonusDateRange.to = new Date();
                    break;
            }

            // Load the bonus data immediately after updating the date range
            $scope.loadBonusData();
        }
    };

    // Update the loadBonusData function to include status filter
    $scope.loadBonusData = function() {
        if (!$scope.personnelSelected) {
            return;
        }

        $scope.loadingBonusData = true;

        var params = {
            personnelId: $scope.personnelSelected._id,
            fromDate: $filter('date')($scope.bonusDateRange.from, 'yyyy-MM-dd'),
            toDate: $filter('date')($scope.bonusDateRange.to, 'yyyy-MM-dd')
        };

        // Only add status filter if it's not 'all'
        if ($scope.bonusStatusFilter && $scope.bonusStatusFilter !== 'all') {
            params.status = $scope.bonusStatusFilter;
        }

        // Fetch bonus data from API
        $http.get('/api/bonus/allocations', { params: params })
            .then(function(response) {
                $scope.bonusData = response.data;

                // Calculate summary
                var totalGross = 0;
                var totalTax = 0;
                var totalNet = 0;

                $scope.bonusData.forEach(function(bonus) {
                    // Handle different bonus data structures with enhanced calculation from BonusInstanceWizardCtrl
                    var grossAmount = 0;
                    var netAmount = 0;
                    var taxAmount = 0;

                    // Determine gross amount from calculatedAmount with fallbacks
                    if (typeof bonus.calculatedAmount === 'number') {
                        grossAmount = bonus.calculatedAmount;
                    } else if (typeof bonus.amount === 'number') {
                        grossAmount = bonus.amount;
                    } else if (typeof bonus.finalAmount === 'number') {
                        grossAmount = bonus.finalAmount; // Last resort if no other amounts available
                    }

                    // Determine net amount from finalAmount with fallbacks
                    if (typeof bonus.finalAmount === 'number') {
                        netAmount = bonus.finalAmount;
                    } else if (typeof bonus.calculatedAmount === 'number' && bonus.calculationInputs && typeof bonus.calculationInputs.taxAmount === 'number') {
                        netAmount = bonus.calculatedAmount - bonus.calculationInputs.taxAmount;
                    } else {
                        netAmount = grossAmount; // Default if no finalAmount is available
                    }

                    // Calculate tax as the difference between gross and net
                    taxAmount = grossAmount - netAmount;

                    // Ensure we don't have negative tax values
                    if (taxAmount < 0) {
                        taxAmount = 0;
                        // If tax is negative, adjust net amount to not exceed gross
                        netAmount = grossAmount;
                    }

                    totalGross += grossAmount;
                    totalTax += taxAmount;
                    totalNet += netAmount;

                    // Add computed properties for display with 2 decimal places
                    bonus.displayGross = grossAmount;
                    bonus.displayTax = taxAmount;
                    bonus.displayNet = netAmount;

                    // Format date for display - handle missing period data
                    if (bonus.instanceId && bonus.instanceId.referencePeriod) {
                        bonus.displayPeriod = $filter('date')(new Date(bonus.instanceId.referencePeriod), 'MMMM yyyy');
                    } else if (bonus.period) {
                        bonus.displayPeriod = bonus.period;
                    } else if (bonus.createdAt) {
                        // If no period data, use creation date as fallback
                        var createdDate = new Date(bonus.createdAt);
                        bonus.displayPeriod = $filter('date')(createdDate, 'MMMM yyyy');
                    } else {
                        bonus.displayPeriod = gettextCatalog.getString('N/A');
                    }
                });

                $scope.bonusSummary = {
                    count: $scope.bonusData.length,
                    totalGross: totalGross,
                    totalTax: totalTax,
                    totalNet: totalNet
                };

                $scope.loadingBonusData = false;
            })
            .catch(function(error) {
                console.error('Error loading bonus data:', error);
                $scope.loadingBonusData = false;
                $rootScope.kernel.alerts.push({
                    type: 1,
                    msg: gettextCatalog.getString('Failed to load bonus data. Please try again later.'),
                    priority: 2
                });
            });
    };

    // Format currency values
    $scope.formatCurrency = function(value) {
        return $filter('currency')(value, '', 0);
    };

    // Export bonus data as Excel or PDF
    $scope.exportBonusData = function(format) {
        if (!$scope.personnelSelected || $scope.bonusData.length === 0) {
            $rootScope.kernel.alerts.push({
                type: 2,
                msg: gettextCatalog.getString('No bonus data to export'),
                priority: 1
            });
            return;
        }

        var params = {
            personnelId: $scope.personnelSelected._id,
            fromDate: $filter('date')($scope.bonusDateRange.from, 'yyyy-MM-dd'),
            toDate: $filter('date')($scope.bonusDateRange.to, 'yyyy-MM-dd'),
            format: format || 'pdf' // Default to PDF if not specified
        };

        $rootScope.kernel.loading = 50;

        if (format === 'excel') {
            // Download the Excel file
            $window.location.href = '/api/bonus/personnel/export?' +
                'personnelId=' + params.personnelId +
                '&fromDate=' + params.fromDate +
                '&toDate=' + params.toDate +
                '&format=excel';
        } else {
            // Download as PDF
            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                var FileSaver = $injector.get('FileSaver');
                var deferred = $q.defer();
                $scope.promise = deferred.promise;


                $http({
                    method: 'GET',
                    url: '/api/bonus/personnel/export',
                    params: params,
                    headers: {'Content-Type': "application/pdf"},
                    responseType: "arraybuffer"
                }).then(function (response) {
                    console.log('Exporting bonus data as PDF:', response);
                    var d = new Blob([response.data], {type: "application/pdf"});
                    var filename = 'Bonus_Summary_' +
                        $scope.personnelSelected.fname + '_' +
                        $filter('date')($scope.bonusDateRange.from, 'yyyy') + '_' +
                        $filter('date')($scope.bonusDateRange.to, 'yyyy') +
                        '.pdf';

                    FileSaver.saveAs(d, filename);
                    $rootScope.kernel.loading = 100;
                    deferred.resolve(response.data);

                    $rootScope.kernel.alerts.push({
                        type: 0,
                        msg: gettextCatalog.getString('Bonus summary exported successfully'),
                        priority: 1
                    });
                }).catch(function (error) {
                    console.error('Error exporting bonus data:', error);
                    $rootScope.kernel.loading = 100;
                    $rootScope.kernel.alerts.push({
                        type: 1,
                        msg: gettextCatalog.getString('Failed to export bonus data. Please try again later.'),
                        priority: 2
                    });
                });
            });
        }
    };

    // Format date values
    $scope.formatDate = function(dateString) {
        return $filter('date')(dateString, 'dd/MM/yyyy');
    };

    // Get status text and class for bonus
    $scope.getBonusStatusInfo = function(status) {
        var statusMap = {
            'eligible': { text: gettextCatalog.getString('Eligible'), class: 'text-primary' },
            'excluded': { text: gettextCatalog.getString('Excluded'), class: 'text-danger' },
            'adjusted': { text: gettextCatalog.getString('Adjusted'), class: 'text-warning' },
            'paid': { text: gettextCatalog.getString('Paid'), class: 'text-success' }
        };

        return statusMap[status] || { text: status, class: 'text-muted' };
    };

    $scope.helper = {
        icon: 'search',
        title: gettextCatalog.getString("Use input to search for a personnal record")
    };

    $scope.edit = function (params) {
        $state.go("home.staffs.edit", params);
    };

    $scope.currentTab = 0;

    $scope.selectTab = function (tab) {
        $scope.currentTab = tab;

        // Load bonus data when bonus tab is selected
        if (tab === 3 && $scope.personnelSelected) {
            $scope.updateBonusPeriodSelection();
        }
    };

    function sortMe(a, b) {
        return new Date(b.dateOf).getTime() - new Date(a.dateOf).getTime();
    }


    $ocLazyLoad.load('../node_modules/angular-base64/angular-base64.js').then(function () {

        $ocLazyLoad.load('js/services/StaffService.js').then(function () {
            var Staffs = $injector.get('Staff');
            $ocLazyLoad.load('js/services/DocumentService.js').then(function () {
                var Document = $injector.get('Document');
                $ocLazyLoad.load('js/services/AffectationService.js').then(function () {
                    var Affectation = $injector.get('Affectation');
                    $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
                        var Dictionary = $injector.get('Dictionary');
                        Dictionary.jsonList({dictionary: "personnel", levels: ['profile']}).then(function (response) {
                            dictionary.profiles = response.data.jsonList;
                            Dictionary.jsonList({dictionary: "personnel", levels: ['skills']}).then(function (response) {
                                dictionary.skills = response.data.jsonList;
                                Dictionary.jsonList({dictionary: "acts", levels: ['natures']}).then(function (response) {
                                    dictionary.natures = response.data.jsonList;


                                    $scope.pdf1 = function () {
                                        $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                                            var FileSaver = $injector.get('FileSaver');
                                            $rootScope.kernel.loading = 0;
                                            var deferred = $q.defer();
                                            $scope.promise = deferred.promise;
                                            $http({
                                                method: 'GET',
                                                url: '/api/pdf/pdf1/',
                                                headers: {'Content-Type': "application/pdf"},
                                                responseType: "arraybuffer"
                                            }).then(function (response) {
                                                var d = new Blob([response.data], {type: "application/pdf"});
                                                FileSaver.saveAs(d, 'CV_xxx.pdf');
                                                $rootScope.kernel.loading = 100;
                                                deferred.resolve(response.data);
                                            }).catch(function (response) {
                                                console.error(response);
                                            });
                                        });

                                    };


                                    function createFilterFor(query) {
                                        var lowercaseQuery = query.toLowerCase();
                                        return function filterFn(item) {
                                            return (item.value.indexOf(lowercaseQuery) === 0);
                                        };
                                    }

                                    function getDictionaryItemByValue(dictionaryList, itemValue) {
                                        var items = $.grep(dictionaryList, function (c, i) {
                                            return c.value === itemValue;
                                        });
                                        if (items && items.length > 0) {
                                            return items[0];
                                        } else {
                                            return undefined;
                                        }
                                    }

                                    //Patient Query search
                                    $scope.personnelQuerySearch = function (text) {
                                        $scope.personnelSelected = undefined;
                                        var deferred = $q.defer();
                                        var results = text ? createFilterFor(text) : deferred;
                                        Staffs.search({text: text}).then(function (response) {
                                            var result = response.data;
                                            if (!result || result === 'null' | result === null) {
                                                result = [];
                                            }
                                            deferred.resolve(result);
                                        }).catch(function (response) {
                                            console.log(response);
                                        });
                                        return deferred.promise;
                                    };

                                    function readStaff(query) {
                                        Staffs.read({
                                            id: id,
                                            beautify: true
                                        }).then(function (response) {
                                            $scope.selectedPersonnelChange(response.data);
                                            $scope.back = function () {
                                                $state.go(oldPath);
                                            };
                                        }).catch(function (response) {
                                            $rootScope.kernel.alerts.push({
                                                type: 1,
                                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                priority: 2
                                            });
                                            console.error(response);
                                        });
                                    }

                                    if (id) {
                                        readStaff(id);
                                    }


                                    $scope.newSanction = function (personnel, type) {
                                        var form = "sanction.html";
                                        if (type === '3') {
                                            form = "award.html";
                                        }
                                        $ocLazyLoad.load('js/controllers/staffs/staff/SanctionCtrl.js').then(function () {
                                            $mdDialog.show({
                                                controller: 'SanctionController',
                                                templateUrl: '../templates/dialogs/' + form,
                                                parent: angular.element(document.body),
                                                clickOutsideToClose: true,
                                                locals: {
                                                    params: {
                                                        personnel: personnel,
                                                        type: type
                                                    }
                                                }
                                            }).then(function (answer) {
                                                readStaff(id);
                                                //Update the user sanctions after the update
                                                $scope.$broadcast('sanctionupdated', []);
                                            }, function () {
                                                readStaff(id);
                                            });
                                        });
                                    }


                                    $scope.newAffectation = function (personnel) {
                                        $ocLazyLoad.load('js/controllers/administration/positions/AffectationCtrl.js').then(function () {
                                            $mdDialog.show({
                                                controller: 'AffectationController',
                                                templateUrl: '../templates/dialogs/affectation.html',
                                                parent: angular.element(document.body),
                                                clickOutsideToClose: true,
                                                locals: {
                                                    params: {
                                                        personnel: personnel
                                                    }
                                                }
                                            }).then(function (answer) {
                                            }, function () {
                                            });
                                        });
                                    };

                                    $scope.newStaffSituation = function (personnel) {
                                        $ocLazyLoad.load('js/controllers/staffs/staff/SituationCtrl.js').then(function () {
                                            $mdDialog.show({
                                                controller: 'SituationController',
                                                templateUrl: '../templates/dialogs/situation.html',
                                                parent: angular.element(document.body),
                                                clickOutsideToClose: true,
                                                locals: {
                                                    params: {
                                                        personnel: personnel
                                                    }
                                                }
                                            }).then(function (answer) {
                                            }, function () {
                                            });
                                        });
                                    }


                                    $scope.selectedPersonnelChange = function (personnel) {
                                        if (personnel) {
                                            $scope.personnelSelected = personnel;
                                            $rootScope.selectedPersonnelId = personnel._id;
                                            loadsHistory();
                                            loadsDocuments();



                                            $scope.userImage = "templates/staffs/img/" + personnel.mysqlId + ".jpeg";
                                            if (personnel.mysqlId != "351" && personnel.mysqlId != "372" && personnel.mysqlId != "97") {
                                                $scope.userImage = "templates/staffs/img/unknow.png";
                                            }

                                            function prepareRequiredItemsToAngular() {
                                                var profiles = [];
                                                var skills = [];
                                                if ($scope.personnelSelected) {
                                                    if ($scope.personnelSelected.profiles) {
                                                        for (i = 0; i < $scope.personnelSelected.profiles.length; i++) {
                                                            if ($scope.personnelSelected.profiles [i]) {
                                                                profiles.push(getDictionaryItemByValue(dictionary.profiles, $scope.personnelSelected.profiles[i]));
                                                            }
                                                        }
                                                    }
                                                    if ($scope.personnelSelected.skills) {
                                                        for (i = 0; i < $scope.personnelSelected.skills.length; i++) {
                                                            if ($scope.personnelSelected.skills [i]) {
                                                                skills.push(getDictionaryItemByValue(dictionary.skills, $scope.personnelSelected.skills[i]));
                                                            }
                                                        }
                                                    }
                                                }
                                                $scope.profiles = profiles;
                                                $scope.skills = skills;
                                            }

                                            prepareRequiredItemsToAngular();

                                            $scope.add = function (personnel, moreField, resourcesDistionary) {
                                                var personnel = personnel;

                                                $mdDialog.show({
                                                    controller: ['$scope', '$mdDialog', 'personnel', '$q', 'dictionary', 'moreField', 'resourcesDistionary', function ($scope, $mdDialog, personnel, $q, dictionary, moreField, resourcesDistionary) {
                                                            $scope.personnel = personnel;
                                                            $scope.detailDescription = {};
                                                            $scope.detailDescription.name = resourcesDistionary;
                                                            if (resourcesDistionary == "profiles") {
                                                                $scope.detailDescription.title = gettextCatalog.getString("Select profiles (You can add up to 05 profiles):");
                                                                $scope.detailDescription.placeholder = gettextCatalog.getString("Choose profile");
                                                            } else if (resourcesDistionary == "skills") {
                                                                $scope.detailDescription.title = gettextCatalog.getString("Select skills (You can add up to 05 skills):");
                                                                $scope.detailDescription.placeholder = gettextCatalog.getString("Choose a skill");
                                                            }


                                                            function prepareDetailsForServer() {
                                                                if ($scope.personnel) {
                                                                    $scope.personnel[moreField] = [];
                                                                    for (i = 0; i < $scope.selectedDetails.length; i++) {
                                                                        if ($scope.selectedDetails[i]) {
                                                                            $scope.personnel[moreField].push($scope.selectedDetails[i].id);
                                                                        }
                                                                    }
                                                                }
                                                            }

                                                            function prepareDetailsForAngular() {
                                                                var requiredDetails = [];
                                                                if ($scope.personnel) {
                                                                    if ($scope.personnel[moreField]) {
                                                                        for (i = 0; i < $scope.personnel[moreField].length; i++) {
                                                                            if ($scope.personnel[moreField] [i]) {
                                                                                requiredDetails.push(getDictionaryItemByValue(dictionary[resourcesDistionary], $scope.personnel[moreField][i]));
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                $scope.selectedDetails = requiredDetails;
                                                            }

                                                            prepareDetailsForAngular();

                                                            $scope.querySearchInProfiles = function (text) {
                                                                var deferred = $q.defer();
                                                                if (text) {
                                                                    var profile = $.grep(dictionary[resourcesDistionary], function (c, i) {
                                                                        return c.name.toLowerCase().includes(text.toLowerCase());
                                                                    });
                                                                    deferred.resolve(profile);
                                                                } else {
                                                                    deferred.resolve(dictionary[resourcesDistionary]);
                                                                }
                                                                return deferred.promise;
                                                            }

                                                            $scope.transformChip = function (chip) {
                                                                // If it is an object, it's already a known chip
                                                                if (angular.isObject(chip)) {
                                                                    return chip;
                                                                }
                                                                // Otherwise, return null;
                                                                return null;
                                                            }

                                                            ;
                                                            $scope.close = function () {
                                                                $mdDialog.hide();
                                                            }
                                                            $scope.cancel = function () {
                                                                $mdDialog.cancel();
                                                            };
                                                            $scope.save = function (params) {
                                                                $scope.personnel[moreField] = $scope.selectedDetails;

                                                                prepareDetailsForServer();

                                                                var positionToUpdate = {
                                                                    _id: $scope.personnel._id,
                                                                    identifier: $scope.personnel.identifier
                                                                };
                                                                positionToUpdate[moreField] = $scope.personnel[moreField];

                                                                Staffs.upsert(positionToUpdate).then(function (response) {
                                                                    $mdDialog.hide();
                                                                    prepareRequiredItemsToAngular();
                                                                    $rootScope.kernel.alerts.push({
                                                                        type: 3,
                                                                        msg: gettextCatalog.getString('The staff has been updated'),
                                                                        priority: 4
                                                                    });
                                                                }).catch(function (response) {
                                                                    $rootScope.kernel.loading = 100;
                                                                    $rootScope.kernel.alerts.push({
                                                                        type: 1,
                                                                        msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                                        priority: 2
                                                                    });
                                                                });
                                                            };

                                                        }],
                                                    templateUrl: '../templates/dialogs/detail.html',
                                                    parent: angular.element(document.body),
                                                    clickOutsideToClose: true,
                                                    locals: {
                                                        personnel: personnel,
                                                        dictionary: dictionary,
                                                        moreField: moreField,
                                                        resourcesDistionary: resourcesDistionary
                                                    }
                                                }).then(function (answer) {

                                                }, function () {

                                                });
                                            }

                                        } else {
                                            $scope.personnelSelected = undefined;
                                            $scope.events = [];
                                        }
                                    }



                                    loadsHistory = function () {
                                        var deferred = $q.defer();
                                        $rootScope.kernel.loading = 0;
                                        $scope.helper = [];
                                        var limit = 0;
                                        var skip = 0;
                                        var filterParams = {}
                                        $scope.search = $scope.personnelSelected.identifier;
                                        Affectation.list({limit: limit, skip: skip, search: $scope.search, filters: JSON.stringify(filterParams)}).then(function (response) {
                                            var data = response.data;
                                            $rootScope.kernel.loading = 100;
                                            $scope.allAffectations = data;
                                            return deferred.promise;
                                        }).catch(function (response) {
                                            console.log(response);
                                        });
                                    }

                                    loadsDocuments = function () {
                                        var deferred = $q.defer();
                                        $rootScope.kernel.loading = 0;
                                        $scope.helper = [];
                                        var limit = 0;
                                        var skip = 0;
                                        var filterParams = {
                                            owner: undefined
                                        };
                                        Document.list({limit: limit, skip: skip, search: $scope.search, filters: JSON.stringify(filterParams)}).then(function (response) {
                                            var data = response.data;
                                            $rootScope.kernel.loading = 100;

                                            $scope.documents = {
                                                data: data,
                                                count: data.length
                                            };
                                            return deferred.promise;
                                        }).catch(function (response) {
                                            console.log(response);
                                        });

                                        $scope.new = function (p) {
                                            console.log(p)
                                            $ocLazyLoad.load('js/controllers/staffs/staff/PhysicalRecordCtrl.js').then(function () {
                                                $mdDialog.show({
                                                    controller: 'PhysicalRecordController',
                                                    templateUrl: '../templates/dialogs/physicalRecord.html',
                                                    parent: angular.element(document.body),
                                                    clickOutsideToClose: true,
                                                    locals: {
                                                        params: {
                                                            p: p
                                                        }
                                                    }
                                                }).then(function (answer) {
                                                    //$scope.getAffectations();
                                                }, function () {
                                                });
                                            });
                                        };

                                        $scope.editDoc = function (doc) {
                                            $ocLazyLoad.load('js/controllers/staffs/staff/PhysicalRecordCtrl.js').then(function () {
                                                $mdDialog.show({
                                                    controller: 'PhysicalRecordController',
                                                    templateUrl: '../templates/dialogs/physicalRecord.html',
                                                    parent: angular.element(document.body),
                                                    clickOutsideToClose: true,
                                                    locals: {
                                                        params: {
                                                            doc: doc
                                                        }
                                                    }
                                                }).then(function (answer) {
                                                    //$scope.getAffectations();
                                                }, function () {
                                                });
                                            });
                                        };

                                        $scope.showConfirm = function (document) {
                                            var confirm = $mdDialog.confirm()
                                                    .title(gettextCatalog.getString("Delete this document"))
                                                    .textContent(gettextCatalog.getString("Are you sure you want to delete this document") + " " + document.fileName + gettextCatalog.getString("?"))
                                                    .ok(gettextCatalog.getString("Delete"))
                                                    .cancel(gettextCatalog.getString("Cancel"));

                                            $mdDialog.show(confirm).then(function () {
                                                // Delete
                                                Document.delete({
                                                    id: document._id
                                                }).then(function (response) {
                                                    $scope.getDocuments();
                                                    $rootScope.kernel.alerts.push({
                                                        type: 3,
                                                        msg: gettextCatalog.getString('The document has been deleted successfully'),
                                                        priority: 4
                                                    });
                                                }).catch(function (response) {
                                                    console.log(response);
                                                });
                                            }, function () {
                                                // Cancel
                                            });
                                        }


                                        $scope.download = function (document) {
                                            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                                                var FileSaver = $injector.get('FileSaver');
                                                $rootScope.kernel.loading = 0;
                                                var deferred = $q.defer();
                                                $scope.promise = deferred.promise;
                                                function jsonBufferToObject(data, headersGetter, status) {
                                                    var type = headersGetter("Content-Type");
                                                    if (!type.startsWith("application/json")) {
                                                        return data;
                                                    }
                                                    ;
                                                    var decoder = new TextDecoder("utf-8");
                                                    var domString = decoder.decode(data);
                                                    var json = JSON.parse(domString);
                                                    return json;
                                                }

                                                $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                    var Download = $injector.get('Download');
                                                    Download.start({
                                                        method: 'GET',
                                                        url: '/api/documents/download/' + document._id,
                                                        headers: {'Content-Type': "blob"},
                                                        transformResponse: jsonBufferToObject
                                                    }).then(function (response) {
                                                        var d = new Blob([response.data]);
                                                        FileSaver.saveAs(d, document.fileName);
                                                        $rootScope.kernel.loading = 100;
                                                        deferred.resolve(response.data);
                                                    }).catch(function (response) {
                                                        console.error(response);
                                                        if (response.data && response.data.error === '9500') {
                                                            $rootScope.kernel.alerts.push({
                                                                type: 1,
                                                                msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                                                priority: 1
                                                            });
                                                            $rootScope.kernel.loading = 100;
                                                        }
                                                    });
                                                });
                                            });
                                        }


                                        $scope.view = function (document) {
                                            $rootScope.kernel.loading = 0;
                                            var deferred = $q.defer();
                                            $scope.promise = deferred.promise;
                                            function jsonBufferToObject(data, headersGetter, status) {
                                                var type = headersGetter("Content-Type");
                                                if (!type.startsWith("application/json")) {
                                                    return data;
                                                }
                                                ;
                                                var decoder = new TextDecoder("utf-8");
                                                var domString = decoder.decode(data);
                                                var json = JSON.parse(domString);
                                                return json;
                                            }

                                            $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                var Download = $injector.get('Download');
                                                Download.start({
                                                    method: 'GET',
                                                    url: '/api/documents/download/' + document._id,
                                                    headers: {'Content-Type': "blob"},
                                                    transformResponse: jsonBufferToObject
                                                }).then(function (response) {
                                                    var d = new Blob([response.data]);
                                                    $scope.documentToView = d;
                                                    $rootScope.kernel.loading = 100;
                                                    deferred.resolve(response.data);
                                                }).catch(function (response) {
                                                    console.error(response);
                                                });
                                            });
                                        }

                                        $scope.zipAll = function (document) {
                                            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                                                var FileSaver = $injector.get('FileSaver');
                                                $rootScope.kernel.loading = 0;
                                                var deferred = $q.defer();
                                                $scope.promise = deferred.promise;
                                                function jsonBufferToObject(data, headersGetter, status) {
                                                    var type = headersGetter("Content-Type");
                                                    if (!type.startsWith("application/json")) {
                                                        return data;
                                                    }
                                                    ;
                                                    var decoder = new TextDecoder("utf-8");
                                                    var domString = decoder.decode(data);
                                                    var json = JSON.parse(domString);
                                                    return json;
                                                }

                                                $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                    var Download = $injector.get('Download');
                                                    Download.start({
                                                        method: 'GET',
                                                        url: '/api/documents/zip/' + $scope.personnelSelected._id,
                                                        headers: {'Content-Type': "application/zip"},
                                                        transformResponse: jsonBufferToObject
                                                    }).then(function (response) {
                                                        var d = new Blob([response.data]);
                                                        FileSaver.saveAs(d, $scope.personnelSelected._id + ".zip");
                                                        $rootScope.kernel.loading = 100;
                                                        deferred.resolve(response.data);
                                                    }).catch(function (response) {
                                                        console.error(response);
                                                        if (response.data && response.data.error === '9500') {
                                                            $rootScope.kernel.alerts.push({
                                                                type: 1,
                                                                msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                                                priority: 1
                                                            });
                                                            $rootScope.kernel.loading = 100;
                                                        }
                                                    });
                                                });
                                            });
                                        }

                                        $scope.view = function (document) {
                                            $rootScope.kernel.loading = 0;
                                            var deferred = $q.defer();
                                            $scope.promise = deferred.promise;
                                            function jsonBufferToObject(data, headersGetter, status) {
                                                var type = headersGetter("Content-Type");
                                                if (!type.startsWith("application/json")) {
                                                    return data;
                                                }
                                                ;
                                                var decoder = new TextDecoder("utf-8");
                                                var domString = decoder.decode(data);
                                                var json = JSON.parse(domString);
                                                return json;
                                            }
                                            $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                var Download = $injector.get('Download');
                                                Download.start({
                                                    method: 'GET',
                                                    url: '/api/documents/download/' + document._id,
                                                    headers: {'Content-Type': "blob"},
                                                    transformResponse: jsonBufferToObject
                                                }).then(function (response) {
                                                    //var d = new Blob([response.data]);
                                                    var documentToView = new Uint8Array(response.data);
                                                    $mdDialog.show({
                                                        controller: ['$scope', '$mdDialog', 'data', function ($scope, $mdDialog, data) {
                                                                $scope.documentToView = data;
                                                            }],
                                                        templateUrl: '../templates/dialogs/pdfViewer.html',
                                                        parent: angular.element(document.body),
                                                        clickOutsideToClose: true,
                                                        locals: {
                                                            data: documentToView
                                                        }
                                                    }).then(function (answer) {
                                                        //$scope.getAffectations();
                                                    }, function () {
                                                    });
                                                    $rootScope.kernel.loading = 100;
                                                    deferred.resolve(response.data);
                                                }).catch(function (response) {
                                                    console.error(response);
                                                });
                                            });
                                        }

                                        $scope.details = function (p) {
                                            // Increase read 
                                            $ocLazyLoad.load('js/services/DocumentService.js').then(function () {
                                                var Document = $injector.get('Document');
                                                Document.read({id: p._id}).then(function (response) {
                                                    //NO action needed
                                                }).catch(function (response) {
                                                    console.log(response);
                                                });
                                            });
                                            $mdDialog.show({
                                                controller: ['$scope', '$mdDialog', 'p', function ($scope, $mdDialog, p, pdf, pdfjsViewer) {
                                                        $scope.doc = p;
                                                        $scope.close = function () {
                                                            $mdDialog.hide();
                                                        }
                                                        $scope.cancel = function () {
                                                            $mdDialog.cancel();
                                                        };

                                                        $scope.edit = function (doc) {
                                                            $ocLazyLoad.load('js/controllers/staffs/staff/PhysicalRecordCtrl.js').then(function () {
                                                                $mdDialog.show({
                                                                    controller: 'PhysicalRecordController',
                                                                    templateUrl: '../templates/dialogs/physicalRecord.html',
                                                                    parent: angular.element(document.body),
                                                                    clickOutsideToClose: true,
                                                                    locals: {
                                                                        params: {
                                                                            doc: doc
                                                                        }
                                                                    }
                                                                }).then(function (answer) {
                                                                    //$scope.getAffectations();
                                                                }, function () {
                                                                });
                                                            });
                                                        };

                                                        $scope.showConfirm = function (document) {
                                                            var confirm = $mdDialog.confirm()
                                                                    .title(gettextCatalog.getString("Delete this document"))
                                                                    .textContent(gettextCatalog.getString("Are you sure you want to delete this document") + " " + document.fileName + gettextCatalog.getString("?"))
                                                                    .ok(gettextCatalog.getString("Delete"))
                                                                    .cancel(gettextCatalog.getString("Cancel"));

                                                            $mdDialog.show(confirm).then(function () {
                                                                // Delete
                                                                Document1.delete({
                                                                    id: document._id
                                                                }).then(function (response) {
                                                                    $scope.getDocuments();
                                                                    $rootScope.kernel.alerts.push({
                                                                        type: 3,
                                                                        msg: gettextCatalog.getString('The document has been deleted successfully'),
                                                                        priority: 4
                                                                    });
                                                                }).catch(function (response) {
                                                                    console.log(response);
                                                                });
                                                            }, function () {
                                                                // Cancel
                                                            });
                                                        }


                                                        $scope.download = function (document) {
                                                            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                                                                var FileSaver = $injector.get('FileSaver');
                                                                $rootScope.kernel.loading = 0;
                                                                var deferred = $q.defer();
                                                                $scope.promise = deferred.promise;
                                                                function jsonBufferToObject(data, headersGetter, status) {
                                                                    var type = headersGetter("Content-Type");
                                                                    if (!type.startsWith("application/json")) {
                                                                        return data;
                                                                    }
                                                                    ;
                                                                    var decoder = new TextDecoder("utf-8");
                                                                    var domString = decoder.decode(data);
                                                                    var json = JSON.parse(domString);
                                                                    return json;
                                                                }

                                                                $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                                    var Download = $injector.get('Download');
                                                                    Download.start({
                                                                        method: 'GET',
                                                                        url: '/api/documents/download/' + document._id,
                                                                        headers: {'Content-Type': "blob"},
                                                                        transformResponse: jsonBufferToObject
                                                                    }).then(function (response) {
                                                                        var d = new Blob([response.data]);
                                                                        FileSaver.saveAs(d, document.fileName);
                                                                        $rootScope.kernel.loading = 100;
                                                                        deferred.resolve(response.data);
                                                                    }).catch(function (response) {
                                                                        console.error(response);
                                                                        if (response.data && response.data.error === '9500') {
                                                                            $rootScope.kernel.alerts.push({
                                                                                type: 1,
                                                                                msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                                                                priority: 1
                                                                            });
                                                                            $rootScope.kernel.loading = 100;
                                                                        }
                                                                    });
                                                                });
                                                            });
                                                        }


//
                                                        $scope.view = function (document) {
                                                            $rootScope.kernel.loading = 0;
                                                            var deferred = $q.defer();
                                                            $scope.promise = deferred.promise;
                                                            function jsonBufferToObject(data, headersGetter, status) {
                                                                var type = headersGetter("Content-Type");
                                                                if (!type.startsWith("application/json")) {
                                                                    return data;
                                                                }
                                                                ;
                                                                var decoder = new TextDecoder("utf-8");
                                                                var domString = decoder.decode(data);
                                                                var json = JSON.parse(domString);
                                                                return json;
                                                            }
                                                            $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                                var Download = $injector.get('Download');
                                                                Download.start({
                                                                    method: 'GET',
                                                                    url: '/api/documents/download/' + document._id,
                                                                    headers: {'Content-Type': "blob"},
                                                                    transformResponse: jsonBufferToObject
                                                                }).then(function (response) {
                                                                    //var d = new Blob([response.data]);
                                                                    var documentToView = new Uint8Array(response.data);
                                                                    $mdDialog.show({
                                                                        controller: ['$scope', '$mdDialog', 'data', function ($scope, $mdDialog, data) {
                                                                                $scope.documentToView = data;
                                                                            }],
                                                                        templateUrl: '../templates/dialogs/pdfViewer.html',
                                                                        parent: angular.element(document.body),
                                                                        clickOutsideToClose: true,
                                                                        locals: {
                                                                            data: documentToView
                                                                        }
                                                                    }).then(function (answer) {
                                                                        //$scope.getAffectations();
                                                                    }, function () {
                                                                    });
                                                                    $rootScope.kernel.loading = 100;
                                                                    deferred.resolve(response.data);
                                                                }).catch(function (response) {
                                                                    console.error(response);
                                                                });
                                                            });
                                                        }

                                                    }],
                                                templateUrl: '../templates/dialogs/physicalRecordDetails.html',
                                                parent: angular.element(document.body),
                                                clickOutsideToClose: true,
                                                locals: {
                                                    p: p
                                                }
                                            }).then(function (answer) {

                                            }, function () {

                                            });
                                        }


                                    }
                                });
                            });
                        });
                    });
                });
            });
        });


        $ocLazyLoad.load('js/services/SanctionService.js').then(function () {
            var Sanction = $injector.get('Sanction');

            $scope.downloadFollowUpSheet = function () {
                $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                    var FileSaver = $injector.get('FileSaver');
                    $rootScope.kernel.loading = 0;
                    var deferred = $q.defer();
                    $scope.promise = deferred.promise;

                    $http({
                        method: 'GET',
                        url: '/api/export/pdf/followUpSheet/' + $scope.personnelSelected._id,
                        headers: {'Content-Type': "application/pdf"},
                        responseType: "arraybuffer"
                    }).then(function (response) {
                        var d = new Blob([response.data], {type: "application/pdf"});
                        FileSaver.saveAs(d, 'List_of_structures_dgtcfm.pdf');
                        $rootScope.kernel.loading = 100;
                        deferred.resolve(response.data);
                    }).catch(function (response) {
                        console.error(response);
                    });
                });
            };


        });
    });
});
