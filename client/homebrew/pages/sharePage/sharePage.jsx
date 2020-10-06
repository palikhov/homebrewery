require('./sharePage.less');
const React = require('react');
const createClass = require('create-react-class');
const _ = require('lodash');
const cx = require('classnames');
const { Meta } = require('vitreum/headtags');

const Nav = require('naturalcrit/nav/nav.jsx');
const Navbar = require('../../navbar/navbar.jsx');
const PrintLink = require('../../navbar/print.navitem.jsx');
const RecentNavItem = require('../../navbar/recent.navitem.jsx').both;
const Account = require('../../navbar/account.navitem.jsx');


const BrewRenderer = require('../../brewRenderer/brewRenderer.jsx');


const SharePage = createClass({
	getDefaultProps : function() {
		return {
			brew : {
				title     : '',
				text      : '',
				shareId   : null,
				createdAt : null,
				updatedAt : null,
				views     : 0
			}
		};
	},

	componentDidMount : function() {
		document.addEventListener('keydown', this.handleControlKeys);
	},
	componentWillUnmount : function() {
		document.removeEventListener('keydown', this.handleControlKeys);
	},
	handleControlKeys : function(e){
		if(!(e.ctrlKey || e.metaKey)) return;
		const P_KEY = 80;
		if(e.keyCode == P_KEY){
			window.open(`/print/${this.props.brew.shareId}?dialog=true`, '_blank').focus();
			e.stopPropagation();
			e.preventDefault();
		}
	},

	renderSourceButton : function() {
		let shareLink = this.props.brew.shareId;
		if(this.props.brew.googleId) {
			shareLink = this.props.brew.googleId + shareLink;
		}

		return <Nav.item href={`/source/${shareLink}`} color='teal' icon='fa-code'>
			source
		</Nav.item>;
	},

	render : function(){
		return <div className='sharePage page'>
			<Meta name='robots' content='noindex, nofollow' />
			<Navbar>
				<Nav.section>
					<Nav.item className='brewTitle'>{this.props.brew.title}</Nav.item>
				</Nav.section>

				<Nav.section>
					<PrintLink shareId={this.props.brew.shareId} />
					{this.renderSourceButton()}
					<RecentNavItem brew={this.props.brew} storageKey='view' />
					<Account />
				</Nav.section>
			</Navbar>

			<div className='content'>
				<BrewRenderer text={this.props.brew.text} />
			</div>
		</div>;
	}
});

module.exports = SharePage;
