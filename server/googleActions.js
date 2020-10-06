/* eslint-disable max-lines */
const _ = require('lodash');
const { google } = require('googleapis');
const { nanoid } = require('nanoid');
const token = require('./token.js');
const config = require('nconf')
	.argv()
	.env({ lowerCase: true })	// Load environment variables
	.file('environment', { file: `config/${process.env.NODE_ENV}.json` })
	.file('defaults', { file: 'config/default.json' });

//let oAuth2Client;

GoogleActions = {

	authCheck : (account, res)=>{
		console.log('RUNNING AUTH CHECK');

		if(!account || !account.googleId){ // If not signed into Google
			const err = new Error('Not Signed In');
			err.status = 401;
			throw err;
		}

		const oAuth2Client = new google.auth.OAuth2(
			config.get('googleClientId'),
			config.get('googleClientSecret'),
			'/auth/google/redirect'
		);

		oAuth2Client.setCredentials({
			access_token  : account.googleAccessToken, //Comment out to refresh token
			refresh_token : account.googleRefreshToken
		});

		oAuth2Client.on('tokens', (tokens)=>{
			if(tokens.refresh_token) {
				account.googleRefreshToken = tokens.refresh_token;
			}
			account.googleAccessToken = tokens.access_token;
			const JWTToken = token.generateAccessToken(account);
			console.log('Updated Access Token');

			//Save updated token to cookie
			res.cookie('nc_session', JWTToken, { maxAge: 1000*60*60*24*365, path: '/', sameSite: 'lax' });
			//res.cookie('nc_session', JWTToken, {maxAge: 1000*60*60*24*365, path: '/', sameSite: 'lax', domain: '.naturalcrit.com'});
		});

		return oAuth2Client;
	},

	getGoogleFolder : async (req, res)=>{
		console.log('getting google folder');
		oAuth2Client = GoogleActions.authCheck(req.account, res);

		const drive = google.drive({ version: 'v3', auth: oAuth2Client });

		fileMetadata = {
			'name'     : 'Homebrewery',
			'mimeType' : 'application/vnd.google-apps.folder'
		};

		const obj = await drive.files.list({
			q : 'mimeType = \'application/vnd.google-apps.folder\''
		})
		.catch((err)=>{
			console.log('Error searching Google Drive Folders');
			console.error(err);
		});

		let folderId;

		if(obj.data.files.length == 0){
			console.log('no folders found');	// CREATE APP FOLDER

			const obj = await drive.files.create({
				resource : fileMetadata
			})
			.catch((err)=>{
				console.log('Error creating google app folder');
				console.error(err);
			});

			console.log('created new drive folder with ID:');
			console.log(obj.data.id);
			folderId = obj.data.id;
		} else {
			folderId = obj.data.files[0].id;
		}

		return folderId;
	},

	getGoogleFolderNew : async (auth)=>{
		console.log('getting google folder');
		const drive = google.drive({ version: 'v3', auth: auth });

		fileMetadata = {
			'name'     : 'Homebrewery',
			'mimeType' : 'application/vnd.google-apps.folder'
		};

		const obj = await drive.files.list({
			q : 'mimeType = \'application/vnd.google-apps.folder\''
		})
		.catch((err)=>{
			console.log('Error searching Google Drive Folders');
			console.error(err);
		});

		let folderId;

		if(obj.data.files.length == 0){
			console.log('no folders found');	// CREATE APP FOLDER

			const obj = await drive.files.create({
				resource : fileMetadata
			})
			.catch((err)=>{
				console.log('Error creating google app folder');
				console.error(err);
			});

			console.log('created new drive folder with ID:');
			console.log(obj.data.id);
			folderId = obj.data.id;
		} else {
			folderId = obj.data.files[0].id;
		}

		return folderId;
	},

	listGoogleBrews : async (req, res)=>{

		oAuth2Client = GoogleActions.authCheck(req.account, res);

		const drive = google.drive({ version: 'v3', auth: oAuth2Client });

		const obj = await drive.files.list({
			pageSize : 100,
			fields   : 'nextPageToken, files(id, name, modifiedTime, properties)',
			q        : 'mimeType != \'application/vnd.google-apps.folder\' and trashed = false'
		})
		.catch((err)=>{
	    return console.error(`Error Listing Google Brews: ${err}`);
	  });

		if(obj.data.files.length) {
	    console.log('List Google Brews:');
	    obj.data.files.map((file)=>{
	      console.log(`${file.name} (${file.id})`);
	    });
	  } else {
	    console.log('No files found.');
	  }

		const brews = obj.data.files.map((file)=>{
	    return {
	      text      : '',
	      shareId   : file.properties.shareId,
	      editId    : file.properties.editId,
	      createdAt : null,
	      updatedAt : file.modifiedTime,
	      gDrive    : true,
	      googleId  : file.id,

	      title       : file.properties.title,
	      description : '',
	      tags        : '',
	      published   : false,
	      authors     : [req.account.username],	//TODO: properly save and load authors to google drive
	      systems     : []
	    };
	  });

	  return brews;
	},

	existsGoogleBrew : async (auth, id)=>{
		const drive = google.drive({ version: 'v3', auth: auth });

		const result = await drive.files.get({ fileId: id })
		.catch((err)=>{
			return false;
		});

		if(result){return true;}

		return false;
	},

	updateGoogleBrew : async (req, res)=>{
		oAuth2Client = GoogleActions.authCheck(req.account, res);

		const drive = google.drive({ version: 'v3', auth: oAuth2Client });
		const brew = req.body;

		const media = {
			mimeType : 'text/plain',
			body     : brew.text
		};

		let obj;

		//CHECK IF FILE ALREADY EXISTS
		if(await GoogleActions.existsGoogleBrew(oAuth2Client, req.body.googleId) == true) {
			//IF SO, JUST UPDATE EXISTING FILE
			const fileMetadata = {
				'name'       : `${brew.title}.txt`,
				'properties' : {								//AppProperties is not accessible
					'shareId' : brew.shareId,
					'editId'  : brew.editId,
					'title'   : brew.title,
				}
			};

			obj = await drive.files.update({
				fileId   : req.body.googleId,
				resource : fileMetadata,
				media    : media
			})
			.catch((err)=>{
				console.log('Error saving to google');
				console.error(err);
				//return res.status(500).send('Error while saving');
			});
		} else {
			//IF NOT, CREATE NEW FILE
			const folderId = await GoogleActions.getGoogleFolder(req, res);
			const fileMetadata = {
				'name'       : `${brew.title}.txt`,
				'parents'    : [folderId],
				'properties' : {								//AppProperties is not accessible
					'shareId' : nanoid(12),
					'editId'  : nanoid(12),
					'title'   : brew.title,
				}
			};

			obj = await drive.files.create({
				resource : fileMetadata,
				media    : media
			})
			.catch((err)=>{
				console.log('Error saving to google');
				console.error(err);
			});
		}

		if(obj) {
			//Update permissions
			const permissions = {
		    'type' : 'anyone',
		    'role' : 'writer',
		  };

			await drive.permissions.create({
		    resource : permissions,
		    fileId   : obj.data.id,
		    fields   : 'id',
		  })
			.catch((err)=>{
				console.log('Error updating permissions');
				console.error(err);
			});

			response = {
				brew     : brew,
				googleId : obj.data.id
			};

			return res.status(200).send(response);
		}
	},

	newGoogleBrew : async (auth, brew)=>{
		console.log('CREATE GOOGLE BREW');
		const drive = google.drive({ version: 'v3', auth: auth });

		const media = {
			mimeType : 'text/plain',
			body     : brew.text
		};

		const folderId = await GoogleActions.getGoogleFolderNew(auth);

		const fileMetadata = {
			'name'       : `${brew.title}.txt`,
			'parents'    : [folderId],
			'properties' : {								//AppProperties is not accessible
				'shareId' : nanoid(12),
				'editId'  : nanoid(12),
				'title'   : brew.title,
			}
		};

		const obj = await drive.files.create({
			resource : fileMetadata,
			media    : media
		})
		.catch((err)=>{
			console.log('Error saving to google');
			console.error(err);
			return res.status(500).send('Error while creating google brew');
		});

		if(!obj) return;

		const permissions = {
			'type' : 'anyone',
			'role' : 'writer',
		};

		await drive.permissions.create({
			resource : permissions,
			fileId   : obj.data.id,
			fields   : 'id',
		})
		.catch((err)=>{
			console.log('Error updating permissions');
			console.error(err);
		});

		const newHomebrew = {
			text      : brew.text,
			shareId   : fileMetadata.properties.shareId,
			editId    : fileMetadata.properties.editId,
			createdAt : null,
			updatedAt : null,
			gDrive    : true,
			googleId  : obj.data.id,

			title       : brew.title,
			description : '',
			tags        : '',
			published   : false,
			authors     : [],
			systems     : []
		};

		return newHomebrew;
	},

	readFileMetadata : async (auth, id, accessId, accessType)=>{
		const drive = google.drive({ version: 'v3', auth });

		const obj = await drive.files.get({
			fileId : id,
			fields : 'properties'
		})
		.catch((err)=>{
			console.log('Error loading from Google');
			console.error(err);
			return;
		});

		console.log(`ACCESS TYPE: ${accessType}`);

		if(obj) {
			if(accessType == 'edit' && obj.data.properties.editId != accessId){
				throw ('Edit ID does not match');
			} else if(accessType == 'share' && obj.data.properties.shareId != accessId){
				throw ('Share ID does not match');
			}

			const file = await drive.files.get({
				fileId : id,
				alt    : 'media'
			})
			.catch((err)=>{
				console.log('Error getting file contents from Google');
				console.error(err);
			});

			const brew = {
				text      : file.data,
				shareId   : obj.data.properties.shareId,
				editId    : obj.data.properties.editId,
				createdAt : null,
				updatedAt : null,
				gDrive    : true,
				googleId  : id,

				title       : obj.data.properties.title,
				description : '',
				tags        : '',
				published   : false,
				authors     : [],
				systems     : []
			};

			return (brew);
		}
	},

	deleteGoogleBrew : async (req, res, id)=>{

		console.log('trying to delete google brew');
		oAuth2Client = GoogleActions.authCheck(req.account, res);
		const drive = google.drive({ version: 'v3', auth: oAuth2Client });

		const googleId = id.slice(0, -12);
		const accessId = id.slice(-12);

		const obj = await drive.files.get({
			fileId : googleId,
			fields : 'properties'
		})
		.catch((err)=>{
			console.log('Error loading from Google');
			console.error(err);
			return;
		});

		if(obj && obj.data.properties.editId != accessId) {
			throw ('Not authorized to delete this Google brew');
		}

		await drive.files.delete({
			fileId : googleId
		})
		.catch((err)=>{
			console.log('Can\'t delete Google file');
			console.error(err);
		});

		return res.status(200).send();
	}
};

module.exports = GoogleActions;
