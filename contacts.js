/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is WebContacts.
 *
 * The Initial Developer of the Original Code is
 * the Mozila Foundation
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Philipp von Weitershausen <philipp@weitershausen.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

'use strict';

function debug() {
  let args = Array.slice(arguments);
  args.unshift('DEBUG');
  console.log.apply(console, args);
  dump(Array.join(arguments, ' '));
}

// TODO
//
// - searching/filtering
// - sorting
// - audit all calls for exception handling

const DB_NAME = 'contacts';
const DB_VERSION = 1;
const STORE_NAME = 'contacts';


/**
 * ContactError
 */

const UNKNOWN_ERROR           = 0;
const INVALID_ARGUMENT_ERROR  = 1;
const TIMEOUT_ERROR           = 2;
const PENDING_OPERATION_ERROR = 3;
const IO_ERROR                = 4;
const NOT_SUPPORTED_ERROR     = 5;
const PERMISSION_DENIED_ERROR = 20;

function ContactError(code) {
  this.code = code;
}

ContactError.prototype = {
  UNKNOWN_ERROR:           UNKNOWN_ERROR,
  INVALID_ARGUMENT_ERROR:  INVALID_ARGUMENT_ERROR,
  TIMEOUT_ERROR:           TIMEOUT_ERROR,
  PENDING_OPERATION_ERROR: PENDING_OPERATION_ERROR,
  IO_ERROR:                IO_ERROR,
  NOT_SUPPORTED_ERROR:     NOT_SUPPORTED_ERROR,
  PERMISSION_DENIED_ERROR: PERMISSION_DENIED_ERROR
};

/**
 * Contacts
 */
function Contacts() {
}

Contacts.prototype = {
  /**
   * nsIDOMGlobalPropertyInitializer implementation
   */
  init: function(window) {
    this.window = window;
  },

  /**
   * Cache the DB here.
   */
  db: null,

  /**
   * Prepare the database. This may include opening the database and upgrading
   * it to the latest schema version.
   *
   * @return (via callback) a database ready for use.
   */
  ensureDB: function ensureDB(callback, errorCallback) {
    if (this.db) {
      debug('ensureDB: already have a database, returning early.');
      callback(this.db);
      return;
    }

    let self = this;
    function gotDB(db) {
      self.db = db;
      callback(db);
    }

    let indexedDB = this.window.mozIndexedDB;
    let request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = function onSuccess(event) {
      debug('Opened database:', DB_NAME, DB_VERSION);
      gotDB(event.target.result);
    };

    request.onupgradeneeded = function onUpgradeNeeded(event) {
      debug('Database needs upgrade:', DB_NAME,
            event.oldVersion, event.newVersion);
      debug('Correct new database version:', event.newVersion == DB_VERSION);

      let db = event.target.result;

      switch (event.oldVersion) {
        case 0:
          debug('New database');
          self.createSchema(db);
          break;

        default:
          debug('No idea what to do with old database version:',
                event.oldVersion);
          event.target.transaction.abort();
          errorCallback(new ContactError(IO_ERROR));
          break;
      }
    };

    request.onerror = function onError(event) {
      debug('Failed to open database:', DB_NAME);
      //TODO look at event.target.Code and change error constant accordingly
      errorCallback(new ContactError(IO_ERROR));
    };

    request.onblocked = function onBlocked(event) {
      debug('Opening database request is blocked.');
      errorCallback(new ContactError(IO_ERROR));
    };
  },

  /**
   * Create the initial database schema.
   */
  createSchema: function createSchema(db) {
    let objectStore = db.createObjectStore(STORE_NAME, {keyPath: 'id'});
    objectStore.createIndex('id', 'id', { unique: true });
    objectStore.createIndex('displayName', 'displayName', { unique: false });

    //TODO I want to be doing this:
    objectStore.createIndex('familyName', 'name.familyName', { unique: false });
    objectStore.createIndex('givenName', 'name.givenName', { unique: false });

    // TODO I also want to do this (see bug 692630):
    // objectStore.createIndex('email', 'emails',
    //                         { multientry: true, unique: false });

    //TODO moar indexes here.
    debug('Created object stores and indexes');
  },

  /**
   * Start a new transaction.
   *
   * @param txnType
   *        Type of transaction (e.g. IDBTransaction.READ_WRITE)
   * @param callback
   *        Function to call when the transaction is available. It will
   *        be invoked with the transaction and the 'contacts' object store.
   * @param successCallback [optional]
   *        Success callback to call on a successful transaction commit.
   * @param errorCallback [optional]
   *        Error callback to call when an error is encountered.
   */
  newTxn: function newTxn(txnType, callback, successCallback, errorCallback) {
    this.ensureDB(function(db) {
      debug('Starting new transaction', txnType);
      let txn = db.transaction([STORE_NAME], txnType);

      debug('Retrieving object store', STORE_NAME);
      let store = txn.objectStore(STORE_NAME);

      txn.oncomplete = function onComplete(event) {
        debug('Transaction complete. Returning to callback.');
        successCallback(txn.result);
      };

      // The transaction will automatically be aborted.
      txn.onerror = function onError(event) {
        debug('Caught error on transaction', event.target.errorCode);
        //TODO look at event.target.errorCode and change error constant
        // accordingly.
        errorCallback(new ContactError(UNKNOWN_ERROR));
      };

      callback(txn, store);
    }, errorCallback);
  },


  /**
   * WebContacts API
   */

  /**
   * @param fields
   *        Array naming which fields the caller is interested in.
   * @param successCallback
   *        Callback function to invoke with result array.
   * @param errorCallback [optional]
   *        Callback function to invoke when there was an error.
   * @param options [optional]
   *        Object specifying search options. Possible attributes:
   *        - filter
   *          Object specifying properties and their values to filter by,
   *          e.g. {lastName: 'Smith'} See also
   *         http://specs.wacapps.net/2.0/jun2011/deviceapis/contact.html#::contact::ContactFilter
   *        - search
   *          Object specifying which properties to search for a given string,
   *          e.g. {query: 'john', fields: ['displayName', 'email']}
   *        Possibly supported in the future:
   *        - batching
   *        - sorting by specific keys
   */
  find: function find(fields, successCallback, errorCallback, options) {
    //TODO PENDING_OPERATION_ERROR -- the transactionality of indexedDB should
    // give us this for free
    if (!successCallback)
      throw TypeError('Must provide a success callback.');

    // A bunch of downstream code expects that errorCallback is a function.
    if (typeof errorCallback != 'function')
      errorCallback = function() {};

    if (!fields.length) {
      errorCallback(new ContactError(INVALID_ARGUMENT_ERROR));
      return;
    }

    //TODO verify fields, options

    let self = this;
    this.newTxn(IDBTransaction.READ_ONLY, function(txn, store) {
      if (options && options.filter) {
        self._findWithFilter(txn, store, options.filter);
      } else if (options && options.search) {
        self._findWithSearch(txn, store, options.search);
      } else {
        self._findAll(txn, store);
      }
    }, successCallback, errorCallback);
  },

  _findWithFilter: function _findWithFilter(txn, store, filter) {
    let filter_keys = Object.keys(filter);
    //TODO check whether filter_keys are valid filters.

    let request;
    if (!filter_keys.length) {
      //TODO return error
      debug('No filters provided!');
      return;
    }

    // Query records by first filter. Apply any extra filters later.
    let key = filter_keys.shift();
    let value = filter[key];
    //TODO check whether filter_key is a valid index;
    debug('Getting index', key);
    let index = store.index(key);
    request = index.getAll(value);

    request.onsuccess = function(event) {
      console.log('Request successful.', event.target.result);
      txn.result = event.target.result;
      //TODO filter by additional keys
    };
  },

  _findWithSearch: function _findWithSearch(txn, store, search) {
    let query = search.query.toLowerCase();

    store.getAll().onsuccess = function(event) {
      console.log('Request successful.', event.target.result);
      txn.result = event.target.result.filter(function(record) {
        for (let i = 0; i < search.fields.length; i++) {
          let field = search.fields[i];
          let value;
          switch (field) {
            case 'familyName':
            case 'givenName':
              value = record.name[field];
              break;
            case 'email':
            case 'phoneNumber':
            case 'ims':
              // HACK: Join all values together into a string.
              value = [f.value for each(f in record[field])].join('\n');
            default:
              value = record[field];
          }
          if (value.toLowerCase().indexOf(query) != -1) {
            return true;
          }
        }
        return false;
      });
    };
  },

  _findAll: function _findAll(txn, store) {
    store.getAll().onsuccess = function(event) {
      console.log('Request successful.', event.target.result);
      txn.result = event.target.result;
    };
  },

  create: function create(successCallback, errorCallback, contact) {
    if (!contact.id) {
      contact.id = generateUUID();
    } else {
      // TODO verify that the record doesn't exist yet.
    }

    //TODO ensure the contact has at minimum fields (id, what else?)
    //TODO ensure default values exist
    debug('Going to add', contact.id);
    this.newTxn(IDBTransaction.READ_WRITE, function(txn, store) {
      store.add(contact).onsuccess = function(event) {
        let id = event.target.result;
        debug('Successfully added', id);
        store.get(id).onsuccess = function(event) {
          debug('Retrieving full record for', id);
          txn.result = event.target.result;
        };
      };
    }, successCallback, errorCallback);
  },

  update: function update(successCallback, errorCallback, contact) {
    //TODO verify record, like in create(), especially contact.id
    // probably want to verify that contact.id actually is in the store.
    this.newTxn(IDBTransaction.READ_WRITE, function(txn, store) {
      debug('Going to update', contact.id);
      store.put(contact);
    }, successCallback, errorCallback);
  },

  delete: function delete_(successCallback, errorCallback, id) {
    //TODO verify id
    // what should happen when 'id' doesn't exist?
    this.newTxn(IDBTransaction.READ_WRITE, function(txn, store) {
      debug('Going to delete', id);
      store.delete(id);
    }, successCallback, errorCallback);
  }
};


/**
 * Fake setup for HTML
 */

let contacts = window.navigator.mozContacts = new Contacts();
contacts.init(window);

/**
 * Generate a UUID according to RFC4122 v4 (random UUIDs)
 */
function generateUUID() {
  var chars = '0123456789abcdef';
  var uuid = [];
  var choice;

  uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
  uuid[14] = '4';

  for (var i = 0; i < 36; i++) {
    if (uuid[i]) {
      continue;
    }
    choice = Math.floor(Math.random() * 16);
    // Set bits 6 and 7 of clock_seq_hi to 0 and 1, respectively.
    // (cf. RFC4122 section 4.4)
    uuid[i] = chars[(i == 19) ? (choice & 3) | 8 : choice];
  }

  return uuid.join('');
}

