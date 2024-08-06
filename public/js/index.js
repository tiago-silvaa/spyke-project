
function checkGoogleAuth() {
    fetch('/isGoogleAuthenticated')
        .then(response => response.json())
        .then((data) => {
            if (data.authenticated) {
                document.getElementById('syncGoogleDiv').style.display = 'block';
                document.getElementById('googleAuthDiv').style.display = 'none';
            } else {
                document.getElementById('syncGoogleDiv').style.display = 'none';
                document.getElementById('googleAuthDiv').style.display = 'block';
            }
        })
}


function fetchContacts () {
    fetch('/contactsData')
        .then(response => response.json())
        .then(contacts => {

            displayContacts(contacts);

            document.querySelectorAll('.syncGoogleCheckbox').forEach(checkbox => {
                checkbox.addEventListener('change', async (event) => {
                    const syncFilter = document.querySelector('input[name="filterOptions"]:checked').value;
                    toggleSync(event.target, syncFilter);
                });
            });
        })
}

function displayContacts(contacts, noContactsMessage = 'You have no contacts in your spyke, please add some.') {
    const contactList = document.getElementById('contact-list');
    contactList.innerHTML = '';

    if (contacts.length === 0) {
        contactList.innerHTML = `
            <div class="alert alert-primary alert-dismissible fade show mt-2" style="width: 470px; border-radius: 40px;">
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                <strong>${noContactsMessage}</strong>
            </div>
        `
        
    } else {
        contactList.innerHTML = `
            <table class="table table-bordered table-hover table-striped">
                <thead class="thead-light">
                    <tr class="table-dark">
                        <th style="width: 5%;">Sync</th>
                        <th style="width: 13%;">Name</th>
                        <th style="width: 15%;">Phone Number</th>
                        <th style="width: 25%;">Email</th>
                        <th style="width: 15%;">Job Title</th>
                        <th style="width: 15%;">Company</th>
                        <th style="width: 3%;" class="text-center">Activate Sync</th>
                        <th class="text-center" style="width: 5%;"></th>
                        <th style="width: 5%;"></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `

        const tbody = contactList.querySelector('tbody');

        contacts.forEach(contact => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <button type="button" id="syncContacts" class="btn btn-outline-dark btn-sm" style="border-radius: 50%;"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Sync contact" onclick="syncContact(${contact.id})">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                </td>
                <td class="break-word">${contact.name}</td>
                <td class="break-word">${contact.phone}</td>
                <td class="break-word">${contact.email}</td>
                <td class="break-word">${contact.jobTitle}</td>
                <td class="break-word">${contact.company}</td>
                <td class="text-center">
                    <input type="checkbox" class="syncGoogleCheckbox" data-id="${contact.id}" ${contact.syncGoogle ? 'checked' : ''}>
                </td>
                <td>
                    <button class="btn btn-outline-primary detailsBtn growHover" type="button" style="border-radius: 20px;" data-id="${contact.id}" 
                        data-bs-toggle="modal" data-bs-target="#contactDetailsModal" onclick="fetchContactDetails(${contact.id})">
                            Details
                    </button>
                </td>
                <td class="text-center">
                    <div class="dropdown dropend" style="text-center">
                        <button class="btn btn-outline-dark rounded-circle btn-sm" type="button" id="dropdownMenuButton-${contact.id}" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton-${contact.id}">
                            <li><a class="dropdown-item" href="javascript:void(0);" data-bs-toggle="modal" data-bs-target="#editContactModal" onclick="fillEditForm(${contact.id})">
                                    Edit <i class="fa-solid fa-pen-to-square float-end"></i></a>
                            </li>
                            <li><a class="dropdown-item" href="javascript:void(0);" onclick="deleteContact(${contact.id})" >Delete <i class="fa-solid fa-trash float-end"></i></a></li>
                        </ul>
                    <div class="dropdown">
                </td>
            `;

            tr.addEventListener('dblclick', function() {
                const contactId = contact.id;
                fetchContactDetails(contactId);
        
                const contactDetailsModal = new bootstrap.Modal(document.getElementById('contactDetailsModal'));
                contactDetailsModal.show();
            });

            tbody.appendChild(tr);
        });
    }
}

function updateContactCount(totalContacts) {
    const contactsCount = document.getElementById('contactsCount');
    if (contactsCount) {
        contactsCount.textContent = totalContacts;
    }
}

function fillEditForm(contactId) {
    fetch(`/contacts/${contactId}`)
        .then(response => response.json())
        .then(contact => {
            document.getElementById('contactId').value = contact.id;
            document.getElementById('editContactName').value = contact.name;
            document.getElementById('editContactPhone').value = contact.phone;
            document.getElementById('editContactEmail').value = contact.email;
            document.getElementById('editContactJobTitle').value = contact.jobTitle;
            document.getElementById('editContactCompany').value = contact.company;
            document.getElementById('editContactAddress').value = contact.address;
            document.getElementById('editContactWebsite').value = contact.website;
            if (contact.birthday) {
                let date = new Date(contact.birthday);
                const formattedDate = date.toLocaleDateString('en-CA');
                document.getElementById('editContactBirthday').value = formattedDate;
            } else {
                document.getElementById('editContactBirthday').value = ''; 
            }
            document.getElementById('editContactNotes').value = contact.notes;
        });
}

let currentContactId = null;

document.addEventListener('DOMContentLoaded', () => {

    checkGoogleAuth();

    fetchContacts();

    fetchGoogleContacts();

    document.getElementById('editContactForm').addEventListener('submit', function(event) {
        event.preventDefault(); 

        const contactId = document.getElementById('contactId').value;
        const updatedContact = {
            name: document.getElementById('editContactName').value,
            phone: document.getElementById('editContactPhone').value,
            email: document.getElementById('editContactEmail').value,
            jobTitle: document.getElementById('editContactJobTitle').value,
            company: document.getElementById('editContactCompany').value,
            address: document.getElementById('editContactAddress').value,
            website: document.getElementById('editContactWebsite').value,
            birthday: document.getElementById('editContactBirthday').value === '' ? null : document.getElementById('editContactBirthday').value,
            notes: document.getElementById('editContactNotes').value,
        };

        fetch(`/contacts/${contactId}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedContact)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                const editContactModal = bootstrap.Modal.getInstance(document.getElementById('editContactModal'));
                editContactModal.hide();

                Swal.fire({
                    title: data.message,
                    icon: 'success'
                });

                const contactDetailsModal = bootstrap.Modal.getInstance(document.getElementById('contactDetailsModal'));

                if (contactDetailsModal) {
                    contactDetailsModal.hide()
                }

                fetchContacts();

                const contactsCount = document.getElementById('contactsCount');
                if (contactsCount) {
                    contactsCount.textContent = data.totalContacts;
                }   
            }
        })
        .catch(error => {
            console.error('Error during fetch:', error); // Adicione este log para depuração
        });
    });document.getElementById('editContactForm').addEventListener('submit', function(event) {
        event.preventDefault(); 

        const contactId = document.getElementById('contactId').value;
        const updatedContact = {
            name: document.getElementById('editContactName').value,
            phone: document.getElementById('editContactPhone').value,
            email: document.getElementById('editContactEmail').value,
            jobTitle: document.getElementById('editContactJobTitle').value,
            company: document.getElementById('editContactCompany').value,
            address: document.getElementById('editContactAddress').value,
            website: document.getElementById('editContactWebsite').value,
            birthday: document.getElementById('editContactBirthday').value || null,
            notes: document.getElementById('editContactNotes').value,
        };

        fetch(`/contacts/${contactId}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedContact)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                const editContactModal = bootstrap.Modal.getInstance(document.getElementById('editContactModal'));
                editContactModal.hide();

                Swal.fire({
                    title: data.message,
                    icon: 'success'
                });
                fetchContacts();

                const contactsCount = document.getElementById('contactsCount');
                if (contactsCount) {
                    contactsCount.textContent = data.totalContacts;
                }   
            }
        })
        .catch(error => {
            console.error('Error during fetch:', error); // Adicione este log para depuração
        });
    });

    document.getElementById('editContactBtn').addEventListener('click', () => {
        fillEditForm(currentContactId);
        const contactDetailsModal = bootstrap.Modal.getInstance(document.getElementById('contactDetailsModal'));
        contactDetailsModal.hide();
        const editContactModal = new bootstrap.Modal(document.getElementById('editContactModal'));
        editContactModal.show();
    });
    
    document.getElementById('editContactBtn').addEventListener('click', () => {
        if (currentContactId) {
            editContact(currentContactId);
        }
    })


    document.getElementById('deleteContactBtn').addEventListener('click', () => {
        if (currentContactId) {
            deleteContact(currentContactId);
        }
    });

    document.querySelector('.syncContactsBtn').addEventListener('click', () => {
        if (currentContactId) {
            syncContact(currentContactId);
        }
    });


    document.getElementById('searchContact').addEventListener('input', searchContact);

    document.querySelectorAll('input[name="filterOptions"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const filterOption = this.value;
            if (filterOption === 'all') {
                fetchContacts();
                Swal.fire({
                    position: 'top-start',
                    icon: 'success',
                    title: 'Contacts filter set <strong>off</strong>',
                    toast: true,
                    showConfirmButton: false,
                    timer: 1350,
                    timerProgressBar: true,
                    hideClass: {
                        popup: 'animate__animated animate__fadeOut animate__faster'
                    }
                });
            } else {
                fetchContactsBySync(filterOption);
                if (filterOption === "on") {
                    Swal.fire({
                        position: 'top-start',
                        icon: 'success',
                        title: 'Filtered by the option <strong>Sync On</strong>',
                        toast: true,
                        showConfirmButton: false,
                        timer: 1350,
                        timerProgressBar: true,
                        hideClass: {
                            popup: 'animate__animated animate__fadeOut animate__faster'
                        }
                    });
                } else {
                    Swal.fire({
                        position: 'top-start',
                        icon: 'success',
                        title: 'Filtered by the option <strong>Sync Off</strong>',
                        toast: true,
                        showConfirmButton: false,
                        timer: 1350,
                        timerProgressBar: true,
                        hideClass: {
                            popup: 'animate__animated animate__fadeOut animate__faster'
                        }
                    });
                }
            }
        });
    });
})

document.getElementById('newContactForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const contact = {
        name: document.getElementById('contactName').value,
        phone: document.getElementById('contactPhone').value || '',
        email: document.getElementById('contactEmail').value || '',
        jobTitle: document.getElementById('contactJobTitle').value || '',
        company: document.getElementById('contactCompany').value || '',
        syncGoogle: document.getElementById('syncGoogle').checked,
        address: document.getElementById('contactAddress').value || '',
        website: document.getElementById('contactWebsite').value || '',
        birthday: document.getElementById('contactBirthday').value || null,
        notes: document.getElementById('contactNotes').value || ''
    };

    createContact(contact);
})


function createContact(contact) {
    fetch('/isGoogleAuthenticated')
    .then(response => response.json())
    .then(data => {
        if (contact.syncGoogle && data.authenticated) {
            Swal.fire({
                title: 'Synchronizing with Google...',
                text: 'Please, wait while the contact syncs.',
                icon: 'info',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
        }
        fetch('/addContact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contact)
        })
        .then(response => response.json())
        .then(data => {

            if (data.status === 'duplicate') {
                Swal.fire({
                    title: 'Contact already exists.',
                    text: 'You already have an existing contact with the same name.',
                    icon: 'warning'
                });
            } else if (data.status === 'error') {
                Swal.fire({
                    title: 'Error',
                    text: data.message,
                    icon: 'error'
                });
            } else {
                const newContactmodal = bootstrap.Modal.getInstance(document.getElementById('newContactModal'));
                newContactmodal.hide();
                document.getElementById('newContactForm').reset();
                Swal.fire(
                    'Contact created!',
                    data.message,
                    'success'
                );
                fetchContacts();
                updateContactCount(data.totalContacts);
                document.getElementById('searchContact').value = '';
            }
        })
    });
}

        
function fetchGoogleContacts() {
    fetch('/googleContactsData')
        .then(response => response.json())
        .then(data => {
            const googleContactTable = document.getElementById('google-contacts-table');
            googleContactTable.innerHTML = '';

            data.sort((a, b) => {
                const nameA = a.names ? a.names[0].displayName.toUpperCase() : '';
                const nameB = b.names ? b.names[0].displayName.toUpperCase() : '';
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            });

            if (data.length === 0) {
                googleContactTable.innerHTML = `
                    <div class="alert alert-primary alert-dismissible fade show mt-2" style="width: 450px; border-radius: 40px;">
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                        You have <strong>no contacts</strong> in your <i class="bi bi-google"></i> Contacts.
                    </div>
                `
                
            } else {
                googleContactTable.innerHTML = `
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th style="width: 20%;">Name</th>
                                <th style="width: 20%;">Phone Number</th>
                                <th style="width: 25%;">Email</th>
                                <th style="width: 15%;">Job Title</th>
                                <th style="width: 15%">Company</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                `

                const tbody = googleContactTable.querySelector('tbody');
            
                data.forEach(contact => {
                    const tr = document.createElement('tr');

                    const name = contact.names ? contact.names[0].displayName : '';
                    const phone = contact.phoneNumbers ? contact.phoneNumbers[0].value : '';
                    const email = contact.emailAddresses ? contact.emailAddresses[0].value : '';
                    const jobTitle = contact.organizations && contact.organizations[0].title ? contact.organizations[0].title : '';
                    const company = contact.organizations && contact.organizations[0].name ? contact.organizations[0].name : '';

                        tr.innerHTML = `
                            <td>${name}</td>
                            <td>${phone}</td>
                            <td>${email}</td>
                            <td>${jobTitle}</td>
                            <td>${company}</td>
                        `;

                        tr.addEventListener('dblclick', () => showGoogleContactDetails(contact));
                        tbody.appendChild(tr);
                })
            }         
        })
}

function importGoogleContactsModal() {
    Swal.fire({
        title: 'Import Google Contacts?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Import <i class="bi bi-download"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Importing <img src="/images/google-logo.png" alt="Google Logo G" style="height: 40px; margin-left: 5px; margin-right: 5px;"> Contacts',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            fetch('/importGoogleContacts')
                .then(response => response.json())
                .then(data => {
                    fetchContacts();
                    updateContactCount(data.totalContacts);
                    let googleListModal = bootstrap.Modal.getInstance(document.getElementById('googleList'));
                    googleListModal.hide();
                    Swal.fire({
                        title: 'Imported!',
                        icon: 'success',
                        text: data.message
                    })
                })
        }
    }) 
}

function importGoogleContacts() {
    Swal.fire({
        title: 'Import Google Contacts?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Import <i class="bi bi-download"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Importing <img src="/images/google-logo.png" alt="Google Logo G" style="height: 40px; margin-left: 5px; margin-right: 5px;"> Contacts',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            fetch('/importGoogleContacts')
                .then(response => response.json())
                .then(data => {
                    fetchContacts();
                    document.getElementById('searchContact').value = '';
                    updateContactCount(data.totalContacts);
                    Swal.fire({
                        title: 'Imported!',
                        icon: 'success',
                        text: data.message
                    })
                })
        }
    }) 
}

function syncContacts() {
    Swal.fire({
        title: 'Sync contacts with <img src="/images/google-logo.png" alt="Google Logo G" style="height: 30px; margin-left: 5px; margin-right: 5px;"> ?',
        icon: 'warning',
        text: 'It will synchronize all the contacts you have selected as "Sync with Google".',
        showCancelButton: true,
        confirmButtonText: 'Sync contacts <i class="bi bi-arrow-repeat"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Synchronizing contacts...',
                text: 'It might take some minutes.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            fetch('/syncContacts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(response => response.json())
                .then(data => {
                    fetchContacts();
                    document.getElementById('searchContact').value = '';
                    if (data.success) {
                        Swal.fire({
                            title: 'Synchronized!',
                            icon:'success',
                            text: data.message
                        })
                    } else {
                        Swal.fire({
                            title: data.message,
                            icon:'warning'
                        })
                    }
                })
        }
    }) 
}

function syncExistingContacts() {
    Swal.fire({
        title: 'Sync existing contacts with <img src="/images/google-logo.png" alt="Google Logo G" style="height: 35px; margin-left: 5px; margin-right: 5px;"> ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sync contacts <i class="bi bi-arrow-repeat"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Synchronizing contacts...',
                text: 'It might take some minutes.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            fetch('/syncContacts/googleConfig', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(response => response.json())
                .then(data => {
                    fetchContacts();
                    
                    document.getElementById('searchContact').value = '';

                    if (data.success) {
                        Swal.fire({
                            title: 'Synchronized!',
                            icon:'success',
                            text: data.message
                        })
                    } else {
                        Swal.fire({
                            title: data.message,
                            icon:'warning'
                        })
                    }
                })
        }
    }) 
}

function toggleSync(checkbox, filterOption) {
    const contactId = checkbox.dataset.id;
    if (checkbox.checked) {
        activateSync(contactId, filterOption);
    } else {
        deactivateSync(contactId, filterOption);
    }
}

function activateSync(contactId, filterOption) {
    fetch(`/contacts/${contactId}/activateSync`, {
        method: 'POST',
    })
    .then(response => response.json())
    .then(() => {
        Swal.fire({
            position: 'top-start',
            icon: 'success',
            title: 'Sync option <strong>on</strong>',
            toast: true,
            showConfirmButton: false,
            timer: 1350,
            timerProgressBar: true,
            hideClass: {
                popup: 'animate__animated animate__fadeOut animate__faster'
            }
        });
        if (filterOption === 'all') {
            fetchContacts();
        } else {
            fetchContactsBySync(filterOption);
        }
    })
    .catch(error => {
        Swal.fire('Error!', 'Failed to activate sync.', 'error');
        console.error('Error activating sync:', error);
    });
}

function deactivateSync(contactId, filterOption) {
    fetch(`/contacts/${contactId}/deactivateSync`, {
        method: 'POST',
    })
    .then(response => response.json())
    .then(() => {
        Swal.fire({
            position: 'top-start',
            icon: 'success',
            title: 'Sync option <strong>off</strong>',
            toast: true,
            showConfirmButton: false,
            timer: 1350,
            timerProgressBar: true,
            hideClass: {
                popup: 'animate__animated animate__fadeOut animate__faster'
            }
        });
        if (filterOption === 'all') {
            fetchContacts();
        } else {
            fetchContactsBySync(filterOption);
        }
    })
    .catch(error => {
        Swal.fire('Error!', 'Failed to activate sync.', 'error');
        console.error('Error activating sync:', error);
    });
}

function logout() {

    Swal.fire({
        title: 'Are you sure?',
        icon: 'warning',
        text: 'Do you want to logout?',
        showCancelButton: true,
        confirmButtonText: 'Logout <i class="bi bi-box-arrow-left"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
            })
                .then(response => response.json())
                .then(data => {
                    Swal.fire({
                        title: data.message,
                        icon: 'success'
                    }).then(() => {
                        window.location.href = '/';
                    });
                })
        }
    })
}

function deleteContact(contactId) {
    Swal.fire({
        title: 'Are you sure?',
        text: "Do you want to delete the selected contact?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete contact!'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(`/contacts/${contactId}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
            })
            .then(response => response.json())
            .then(data => {
                fetchContacts();

                document.getElementById('searchContact').value = '';

                updateContactCount(data.totalContacts);

                const contactDetailsModal = bootstrap.Modal.getInstance(document.getElementById('contactDetailsModal'));

                if (contactDetailsModal) {
                    contactDetailsModal.hide()
                }    

                Swal.fire(
                    'Deleted!',
                    'Your contact has been deleted.',
                    'success'
                );
            });
        }
    });
}

function syncContact(contactId) {
    fetch('/isGoogleAuthenticated')
        .then(response => response.json())
        .then(data => {
            if (!data.authenticated) {
                Swal.fire({
                    title: '<img src="/images/google-logo.png" alt="Google Logo G" style="height: 35px; margin-left: 5px; margin-right: 5px;"> Account <br>Connection Required',
                    icon: 'warning'
                })
            } else {
                Swal.fire({
                    title: 'Are you sure?',
                    text: 'Do you want to synchronize this contact with Google?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, synchronize it!'
                }).then((result) => {
                    if (result.isConfirmed) {
                        Swal.fire({
                            title: 'Synchronizing...',
                            allowOutsideClick: false,
                            didOpen: () => {
                                Swal.showLoading();
                            }
                        });

                        fetch(`/contacts/${contactId}/sync`, {
                            method: 'POST'
                        })
                        .then(response => response.json())
                        .then(data => {
                            Swal.close();
                            const contactDetailsModal = bootstrap.Modal.getInstance(document.getElementById('contactDetailsModal'));
                            if (contactDetailsModal) {
                                contactDetailsModal.hide()
                            }  
                            if (data.success) {
                                Swal.fire({
                                    title: 'Synchronized!',
                                    text: data.message,
                                    icon: 'success'
                                });
                            } else {
                                Swal.fire({
                                    title: 'Error!',
                                    text: data.message,
                                    icon: 'error'
                                });
                            }
                        })
                    }
                });
            }
        })
}

function searchContact() {
    const search = document.getElementById('searchContact').value;

    if (search === "") {
        fetchContacts();
    } else {
        fetch(`/search/${search}`)
            .then(response => response.json())
            .then(contacts => {
                const noContactsMessage = `No contacts found with the name "${search}".`;
                displayContacts(contacts, noContactsMessage);
            });
    }
}

function fetchContactsBySync(filterOption) {
    fetch(`/filter/${filterOption}`)
        .then(response => response.json())
        .then(contacts => {
            displayContacts(contacts, noContactsMessage = 'No contacts in the selected filter.');

            document.querySelectorAll('.syncGoogleCheckbox').forEach(checkbox => {
                checkbox.addEventListener('change', async (event) => {
                    const syncFilter = document.querySelector('input[name="filterOptions"]:checked').value;
                    toggleSync(event.target, syncFilter);
                });
            });
        })
        .catch(error => {
            console.error(`Error fetching contacts with sync filter '${filterOption}':`, error);
        });
}


function fetchContactDetails(contactId) {
    currentContactId = contactId;
    fetch(`/contacts/${contactId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('nameDetail').innerHTML = '<i class="fa-solid fa-address-card"></i> ' + data.name;
            document.getElementById('phoneDetail').textContent = data.phone;
            document.getElementById('emailDetail').textContent = data.email;
            document.getElementById('jobTitleDetail').textContent = data.jobTitle;
            document.getElementById('companyDetail').textContent = data.company;
            document.getElementById('addressDetail').textContent = data.address;
            document.getElementById('websiteDetail').textContent = data.website;
            document.getElementById('birthdayDetail').textContent = data.birthday ? new Date(data.birthday).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric'
            }) : '';
            document.getElementById('notesDetail').textContent = data.notes;
        })
}

function showGoogleContactDetails(contact) {

    const modal = new bootstrap.Modal(document.getElementById('contactDetailsModal'));
    const googleContactsModal = bootstrap.Modal.getInstance(document.getElementById('googleList'));
    googleContactsModal.hide()

    const name = contact.names ? contact.names[0].displayName : '';
    const phone = contact.phoneNumbers ? contact.phoneNumbers[0].value : '';
    const email = contact.emailAddresses ? contact.emailAddresses[0].value : '';
    const jobTitle = contact.organizations && contact.organizations[0].title ? contact.organizations[0].title : '';
    const company = contact.organizations && contact.organizations[0].name ? contact.organizations[0].name : '';
    const address = contact.addresses ? contact.addresses.map(addr => addr.formattedValue).join(', ') : '';
    const url = contact.urls ? contact.urls.map(url => {
        let urlValue = url.value;
        if (!urlValue.startsWith('http://') && !urlValue.startsWith('https://')) {
            urlValue = 'http://' + urlValue;
        }
        return `<a href="${urlValue}" target="_blank">${url.value}</a>`;
    }).join(', ') : '';
    const birthday = contact.birthdays ? contact.birthdays[0].date : '';
    const biography = contact.biographies ? contact.biographies[0].value : '';

    document.getElementById('nameDetail').innerHTML = '<i class="fa-solid fa-address-card"></i> ' + name;
    document.getElementById('phoneDetail').textContent = phone;
    document.getElementById('emailDetail').textContent = email;
    document.getElementById('jobTitleDetail').textContent = jobTitle;
    document.getElementById('companyDetail').textContent = company;
    document.getElementById('addressDetail').textContent = address;
    document.getElementById('websiteDetail').innerHTML = url;
    document.getElementById('birthdayDetail').textContent = birthday ? new Date(birthday).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    }) : '';
    document.getElementById('notesDetail').textContent = biography;

    document.querySelector('.syncContactsBtn').classList.add('hidden');
    document.getElementById('editContactBtn').classList.add('hidden');
    document.getElementById('deleteContactBtn').classList.add('hidden');

    modal.show();

    document.getElementById('contactDetailsModal').addEventListener('hidden.bs.modal', () => {
        googleContactsModal.show();
    }, { once: true });

    function resetModalState() {
        document.querySelector('.syncContactsBtn').classList.remove('hidden');
        document.getElementById('editContactBtn').classList.remove('hidden');
        document.getElementById('deleteContactBtn').classList.remove('hidden');
    }

    const contactDetailsModal = document.getElementById('contactDetailsModal');
    contactDetailsModal.addEventListener('hidden.bs.modal', resetModalState);

    

}



