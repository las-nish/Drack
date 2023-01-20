// Project Drack
//
// Developed by Lasan Nishshanka
//
// Copyright (c) 2022 Lasan Nishshanka
// All Rights Reserved

// Global Variable
// ---------------

// Server Variable

const server_web_url = "127.0.0.1";
const server_web_port = 3000;
const server_database_name = "drack_db";

// Response Variable

const status_success = 200; // Status for GET / POST
const status_created = 201; // Status for POST with Create
const status_failed = 400;  // Status when Error

// Required Packages
// -----------------

const express_js = require('express');
const mongoose_js = require('mongoose');
const parser_js = require('body-parser');
const cookie_js = require('cookie-parser');
const ejs_js = require('ejs');
const uuid_js = require('uuid');
const markdown_js = require('markdown-it');
// const socket_js = require('socket.io');
const sock_js = require('sockjs');
const http_js = require('http');
const cors_js = require('cors');
const path_js = require('path');
const file_js = require('fs');
const connect_js = require('connect');

// Message
// -------

function message_note(note_content) {
	console.log('> ' +  note_content);
}

function message_error(error_content) {
	console.log('> Internal Error');
	console.log('> ' + error_content);

	process.exit(1);
}

// Connect Database
// ----------------

mongoose_js.set('strictQuery', false);

mongoose_js.connect("mongodb://" + server_web_url + "/" + server_database_name,
	function (error) {
  	if (error) {
			message_error("Unable to connect MongoDB: " + error);
	  } else {
	    message_note("Successfully connected to MongoDB");
	  }
	}, {
		useNewUrlParser: true
});

// MongoDB Model
// -------------

const model_document = new mongoose_js.Schema({
	document_id: { type: String },          // Generated ID of the Document
	document_title: { type: String },       // Title of the Document
	document_description: { type: String }, // Description of the Document
	document_content: { type: String },     // Content of the Document
	document_status: { type: String },      // Status of the Document
	document_tag: { type: String }          // Tag(s) of the Document
});

// Model Schema
// ------------

const schema_document = mongoose_js.model('schema_document', model_document);

// Server Connection
// -----------------

const server_app = express_js();
const server_http = http_js.createServer(server_app);
// const socket_io = socket_js(server_http);

server_app.use(cors_js());
server_app.use(parser_js.json());
server_app.use(cookie_js());

// Socket Connection
// -----------------

// socket_io.on('connection', (socket) => {
// 	console.log('user connected');
// 	socket.on('disconnect', function () {
// 		console.log('user disconnected');
// 	});
// })

const sockjs_opts = {
	prefix: '/drack_socket'
};

const sockjs_drack = sock_js.createServer(sockjs_opts);

// sockjs_drack.on('connection', function (conn) {
// 	conn.on('data', function (message) {
// 		conn.write(message);
// 	});
// });

// sockjs_drack.on('connection', (conn) => {
// 	conn.on('data', (message) => {
// 		sockjs_drack.clients.forEach((client) => {
// 			client.write(message);
// 		});
// 	});
// });

const connections = [];

// sockjs_drack.on('connection', (conn) => {
// 	connections.push(conn);
//
// 	conn.on('data', (message) => {
// 		connections.forEach(client => {
// 			client.write(message);
// 		});
// 	});
// });

// let socket_client_count = 0;
// let socket_maximum_client = 2;

sockjs_drack.on('connection', (conn) => {
	connections.push(conn);

	// if (socket_client_count >= socket_maximum_client) {
	// 	message_note("Maximum clients reached");
	// 	conn.close();
	// }
	//
	// socket_client_count = socket_client_count + 1;

	conn.on('data', (message) => {
		const data = JSON.parse(message);

		schema_document.findOne({document_id: data.document_id}, (error, document) => {
			if (error) {
				message_note(error);
				return;
			}

			// console.log("Get from  : " + data.document_id);
			// console.log("Update To : " + document.document_id);

			document.document_content = data.document_content;

			document.save((error, updated_document) => {
				if (error) {
					message_note((error));
					return;
				} else {
					const get_message = JSON.stringify({
						document_id: data.document_id,
						document_content: updated_document.document_content
					});

					connections.forEach(client => {
						client.write(get_message);
					});
				}
			});
		});

		// connections.forEach(client => {
		// 	client.write(message);
		// });
	});

	// conn.on('close', () => {
	// 	socket_client_count = socket_client_count - 1;
	// 	message_note("A client has disconnected");
	// 	message_note(("Number of current clients is " + socket_client_count));
	// });
});

sockjs_drack.installHandlers(server_http, { prefix:'/drack_socket' });

// Listen to the Web Server
// ------------------------

server_http.listen(server_web_port, () => {
	message_note("Server is listening on port " + server_web_port);
});

// Routing Structure
// -----------------

server_app.use(parser_js.urlencoded({
	extended: true
}));

// API Routing Structure
// ---------------------

// Create a new Document

server_app.post('/api/create', function (request, response) {
	let is_create_success = false;

	let get_document_id = uuid_js.v1({
		msecs: Date.now()
	});

	schema_document.create({
		document_id: get_document_id,
		document_title: request.body.document_title,
		document_description: request.body.document_description,
		document_content: request.body.document_content,
		document_status: request.body.document_status,
		document_tag: request.body.document_tag
	}, (error) => {
		if (!error) {
			is_create_success = true;
		}

		if (is_create_success == false) {
			// response.status(status_failed).send({ message: 'Unable to create document' });

			response.redirect('/error');
			return;
		} else {
			// response.status(status_created).send({
			// 	message: 'Create success',
			// 	document_id: get_document_id,
			// 	document_title: request.body.document_title,
			// });

			response.redirect('/read?document=' + get_document_id);
			return;
		}
	});
});

// Update a given Document

server_app.post('/api/edit', function (request, response) {
	let is_update_success = false;

	schema_document.findOne({document_id: request.body.document_id}, (error, is_found) => {
		if (!error) {
			if (is_found) {
				const new_data = {
					document_title: request.body.document_title,
					document_description: request.body.document_description,
					document_content: request.body.document_content,
					document_status: request.body.document_status,
					document_tag: request.body.document_tag
				};

				schema_document.updateOne({document_id: request.body.document_id}, {$set: new_data}, (error) => {
					if (!error) {
						is_update_success = true;
					}

					if (is_update_success == false) {
						// response.status(status_failed).send({ message: 'Unable to update document' });

						response.redirect('/error');
						return;
					} else {
						// response.status(status_created).send({
						// 	message: 'Update success',
						// 	document_id: request.body.document_id,
						// 	document_title: request.body.document_title,
						// });

						response.redirect('/read?document=' + request.body.document_id);
						return;
					}
				});
			}
		}
	});
});

// View Engine Setup
// -----------------

server_app.use(express_js.static(path_js.join(__dirname, 'public')));

server_app.set('view engine', 'ejs');
server_app.set('views', path_js.join(__dirname, 'public'));

// Domain Routing Structure
// ------------------------

// Home Page

server_app.get('/', (request, response) => {
	response.render('_index');
});

// Create Page

server_app.get('/create', (request, response) => {
	response.render('_create');
});

// Edit Page
//
// /edit?document=DOCUMENT_ID

server_app.get('/edit', (request, response) => {
	schema_document.findOne({document_id: request.query.document}, (error, is_found) => {
		if (!error) {
			if (is_found) {
				response.render('_edit', {
					get_document_id: request.query.document,
					get_document_title: is_found.document_title,
					get_document_description: is_found.document_description,
					get_document_content: is_found.document_content,
					get_document_status: is_found.document_status,
					get_document_tag: is_found.document_tag,
					get_server_address: server_web_url,
					get_server_port: server_web_port
				});
			} else {
				response.render('_error');
			}
		}
	});
});

// Read Page
//
// /read?document=DOCUMENT_ID

server_app.get('/read', (request, response) => {
	schema_document.findOne({document_id: request.query.document}, (error, is_found) => {
		if (!error) {
			if (is_found) {
				let markdown_parser = new markdown_js();
				const document_content = markdown_parser.render(is_found.document_content);

				response.render('_read', {
					get_document_id: request.query.document,
					get_document_title: is_found.document_title,
					get_document_description: is_found.document_description,
					get_document_content: document_content,
					get_document_status: is_found.document_status,
					get_document_tag: is_found.document_tag
				});
			} else {
				response.render('_error');
			}
		}
	});
});

// Error Page

server_app.all('*', (request, response) => {
	response.render('_error');
});

// Unit Test
// ---------

module.exports.unit_test = function() {
	message_note("Unit Test");

	process.exit();
}