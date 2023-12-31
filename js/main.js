

// initialize matrix parameters
const width = 650, height = 650;
const margin = {right: 0, left: 2, top: 2, bottom: 0};
const plot_width = width - margin.left - margin.right;
const plot_height = height - margin.top - margin.bottom;
var timerId = setTimeout(() => {}, 1000);

// initialize scatter plot vars
const scatter_width = 240, scatter_height = 240;
const scatter_margin = {right: 0, left: 40, top: 0, bottom: 40};
const scatter_plot_width = scatter_width - scatter_margin.left - scatter_margin.right;
const scatter_plot_height = scatter_height - scatter_margin.top - scatter_margin.bottom;

// initialize page
const init_page_from_dataset = function(dec,matrix_type){

	d3.selectAll('svg').remove();

	d3.select('#mask-container')
		.append('svg')
			.attr('id','matrix-mask-svg')
		.append('rect')
			.attr('id','matrix-mouseout-mask')
			.on('mouseover',function(){
				is_dragging = false;
				drag_start = [];
				drag_stop = [];
			})
			

	// select the parent svg
	var svg = d3.select('#svg-container').append("svg")
			.attr("width", width)
			.attr('id','matrix-svg')
			.attr("height", width)
			.style('float','left')
		.append("g")
			.attr('transform','translate(1,1)')
			.attr('id','matrix-svg-trans')

	// initialize background rectangle
	svg.append('rect')
		.attr('class','background-rect')
		.attr('width',plot_height+12)
		.attr('height',plot_height+12)


	// initialize mouseover details box
	svg.append('g')
		.attr('class','mouseover-textgroup')
		.attr('transform','translate(0,0)')
	d3.select('.mouseover-textgroup').append('rect')
		.attr('class','mouseover-textbox')
	d3.select('.mouseover-textgroup').selectAll('text')
			.data(['','','',''])
			.enter()
		.append('text')
			.attr('class','mouseover-text')
			.attr('text-anchor','start')
			.attr('x','.32em')
			.attr('y',function(d,i){return 1.2 + i + 'em'})
			.attr('pointer-events','none')
			.text('')

	// define axes scales and labels
	var x_labels = dec[matrix_type].fields;
	const n = x_labels.length;
	var corr_data = [];
	d3.range(n).forEach((d,i) => {
		corr_data[i] = d3.range(n).map(j => {
			return {x: i,
				x_label: x_labels[i],
				y: j,
				y_label: x_labels[j],
				z: dec[matrix_type].r[i][j],
				n: dec[matrix_type].n[i][j]}});
	});
	
	const xscale = d3.scaleBand()
		.domain(x_labels)
		.range([0,plot_height])
        .paddingOuter(0)
        
	const scatter_scale = init_scatterplot();
		
	// initalize matrix elements
	renderMatrix(corr_data,xscale,x_labels,dec[matrix_type],scatter_scale);
	svg.selectAll(".column")
        .data(corr_data)
				.enter()
		.append("g")
			.attr("class", "column")
			.attr("transform", function(d, i) {
							return `translate(${xscale(x_labels[i])},${plot_height})rotate(-90)`; 
					});

	// initialize matrix cursor rectangle
	svg.append("rect")
			.attr('width',xscale.bandwidth(0))
			.attr('height',xscale.bandwidth(0))
			.attr('id','hover-rect')

	//define assay selections
	const assays = getAssayNames(x_labels);
	const unique_assays = assays.getUnique();
	const assay_idx = unique_assays.map(assay => {
		return d3.range(n).filter(i => { return assays[i] === assay })
	});
	var assay_data = assay_idx.map(i => { 
		return {idx: i.map(ii => { return ii+1; }), 
						fields: i.map(ii => { return x_labels[ii] }),
						list_idx: d3.range(i.length)} 
	});

	if(matrix_type === 'full'){
		init_qselections('assay',unique_assays,assay_data);
		d3.select('#assay-selection-div')
			.attr('class','');
	} else {
		d3.select('#assay-selection-div')
			.attr('class','disabled')
	}
	
		

	// parse distilled matrix apriori grp selections
	const distilled_assays = getAssayNames(dec.distilled.fields);
	const unique_distilled_assays = distilled_assays.getUnique();
	const distilled_assay_idx = unique_distilled_assays.map(assay => {
		return d3.range(distilled_assays.length).filter(i => { return distilled_assays[i] === assay })
	});

	// define apriori grp selections
	const apriori_grps = Object.keys(dec.full.apriori);
	var apriori = apriori_grps.map(g => {return dec.full.apriori[g] });
	for(let i=0; i<apriori.length; i++){
		if(!Array.isArray(apriori[i].idx)){
			apriori[i].idx = [apriori[i].idx];
		}
		apriori[i].list_idx = d3.range(apriori[i].idx.length);
		apriori[i].name = apriori_grps[i];
		apriori[i].dist_idx = distilled_assay_idx[i];
		apriori[i].dist_fields = dec.distilled.fields.filter( function(ll,j){
			return distilled_assay_idx[i].some( ii => {return ii === j} )
		});
		apriori[i].loadings = dec.distilled.loadings.filter( function(ll,j){
			return distilled_assay_idx[i].some( ii => {return ii === j} )
		});
		apriori[i].loadings_labels = dec.distilled.loadings_labels.filter( function(ll,j){
			return distilled_assay_idx[i].some( ii => {return ii === j} )
		});
		apriori[i].loadings_labels = format_loadings_labels(apriori[i].loadings_labels);
	}


	apriori = apriori.map( i => {
		i.fields = i.fields.map( j => { return j.replace('_',' ') } )
		return i;
	});

	if(matrix_type === 'distilled'){

		var dist_qselect_data = [];
		for(let i=0; i<apriori_grps.length; i++){
			dist_qselect_data.push({fields: [], idx: [], list_idx: [], name: null});
		}
		for(let i=0; i<apriori_grps.length; i++){
			dist_qselect_data[i].name = apriori[i].name;
			for(let j=0; j<apriori[i].dist_fields.length; j++){
				dist_qselect_data[i].fields[j] = apriori[i].dist_fields[j];
				dist_qselect_data[i].idx[j] = apriori[i].dist_idx[j] + 1;
				dist_qselect_data[i].list_idx[j] = j;
			}
		}
		init_qselections('behavior',apriori_grps,dist_qselect_data);
	} else {
		init_qselections('behavior',apriori_grps,apriori);
	}


	plot_apriori_barplots(apriori,'Activity');

	// set loadings drop-down menu items
	d3.select('#tab-header').selectAll('option').remove();
	d3.select('#metric-loadings-tab')
		.select('h2').each(function(){
			d3.select(this.parentNode)
				.append('svg')
					.style('display','inline-block')
					.style('position','relative')
					.style('bottom','-4px')
					.style('width','20px')
					.style('height','20px')
				.append('rect')
					.attr('id','loadings-color-tab')
					.style('fill','rgb(255,0,195)')
					.style('width','16px')
					.style('height','16px')
		});

	d3.select('#tab-header')
		.select('select')
			.attr('name','a priori group')
			.data([apriori])
			.on('change', function(d){ 
				const grp_name = d3.select(this).nodes()[0].value;
				const grp_idx = d.map(v=>{ return v.name }).indexOf(grp_name);
				plot_apriori_barplots(d,grp_name);
				update_loading_bar_colors();
				d3.select('#tab-header').select('h2').nodes()[0].innerText = grp_name + ' PCs';
				d3.select('#loadings-color-tab').style('fill',apriori_bar_colors[grp_idx])
			 })
		.selectAll('option')
			.data(apriori_grps)
			.enter()
		.append('option')
			.each( function(d){ d3.select(this).attr('value',d) })
			.text(function(d){ return d })

		init_colorbar();
		init_apriori_rects(apriori,matrix_type,xscale);

		// initialize metric summary dropdown menu
		d3.select('#metric-summary-tab').select('select').selectAll('option').remove()
		d3.select('#metric-summary-tab').select('select')
				.selectAll('option')
						.data(dec[matrix_type].fields)
						.enter()
				.append('option')
						.attr('value',function(d){ return d; })
						.text(function(d){ return d; });
	
		d3.select('#metric-summary-tab')
				.selectAll('tr')
						.filter(function(d,i){ return i>0 })
						.remove();
	
		d3.select('#metric-summary-tab')
				.select('table')
				.selectAll('tr')
						.data(d3.range(8))
						.enter()
				.append('tr')
						.each(function(d){
								d3.select(this).selectAll('td')
										.data(d3.range(3))
										.enter()
								.append('td')
										.each(function(){ d3.select(this).append('p') })
						})

		// set the current value
		var metric_summ_dropdown = d3.select('#metric-summary-tab').select('select').nodes()[0];
		metric_summ_dropdown.value = dec[matrix_type].fields[0];
		metric_summ_dropdown.dispatchEvent(new Event('change',{ value:  dec[matrix_type].fields[0]}));
		clear_tab_notification('Metric Summary');

		// intialize the behavior gene list dropdown
		var behavior_gene_dropdown = d3.select('#behavior-gene-dropdown')
			.selectAll('option')
				.data(dec[matrix_type].fields)

		// append
		behavior_gene_dropdown.enter()
				.append('option')
						.attr('value',function(d){ return d })
						.text(function(d){ return d })
						.on('change',function(){ })
		// remove
		behavior_gene_dropdown.exit().remove()

		// update
		behavior_gene_dropdown
		.attr('value',function(d){ return d })
						.text(function(d){ return d })

		// init behavior gene list table
		d3.select('#behavior-gene-dropdown')
			.on('change',function(){ 
				init_behavior_gene_list_table();
			})

		var behavior_gene_menu = d3.select('#behavior-gene-dropdown').nodes()[0];
		behavior_gene_menu.value = dec[matrix_type].fields[0];
		behavior_gene_menu.dispatchEvent(new Event('change',{value: dec[matrix_type].fields[0]}));

		// set the current value of gene search batch dropdown
		var batch_opts;
		if(get_dataset_idx()){
			batch_opts = ['outbred - batch 1'];
		} else {
			batch_opts = ['inbred - batch 1','inbred - batch 2'];
		}
		var batch_dropdown = d3.select('#batch-select-dropdown').selectAll('option').data(batch_opts);
		batch_dropdown
				.enter()
			.append('option')
				.attr('value',function(d){ return d })
				.text(function(d){ return d })
				

		batch_dropdown.exit().remove();
		batch_dropdown.text(function(d){ return d });

		d3.select('#batch-select-dropdown')
			.on('change',function(){ 

				init_enrichment_table();

				// update gene search
				if(d3.select('#gene-result-textbox').select('div[selected=true]').size()){
					d3.select('#gene-result-textbox').select('div[selected=true]').nodes()[0].click();
				}
			})

		var batch_menu = d3.select('#batch-select-dropdown').nodes()[0];
		batch_menu.value = batch_opts[0];
		batch_menu.dispatchEvent(new Event('change', {value: batch_opts[0]}))

		// update apriori menu
		d3.select('#qselections').select('.selected').nodes()[0].click();	
		update_rect_selections();

		// trigger click on first non-diagonal value
		var first_rect = d3.selectAll('.matrix-rect').filter(function(d,i){ return i===1}).nodes()[0];
		first_rect.dispatchEvent(new Event('click'));
		first_rect.dispatchEvent(new Event('click'));
}


// update page elements with new dataset
const update_page_dataset = function(dec,matrix_type){

	var color = d3.scaleLinear()
		.domain([-1.0000,-0.8745,-0.7490,-0.6235,-0.5059,-0.3804,-0.2549,-0.1294,-0.0118,-0.0039,0.1216,0.2471,0.3725,0.4980,0.6235,0.7490,0.8745,1.0000])
		.range([
			d3.rgb(253,255,255),
			d3.rgb(187,252,255),
			d3.rgb(114,235,255),
			d3.rgb(44,202,255),
			d3.rgb(0,157,255),
			d3.rgb(0,103,255),
			d3.rgb(21,39,255),
			d3.rgb(19,0,201),
			d3.rgb(0,0,0),
			d3.rgb(0,0,0),
			d3.rgb(96,0,0),
			d3.rgb(164,6,0),
			d3.rgb(215,56,0),
			d3.rgb(248,109,0),
			d3.rgb(255,165,0),
			d3.rgb(255,215,0),
			d3.rgb(255,247,107),
			d3.rgb(255,255,251)
		]);

		var x_labels = dec[matrix_type].fields;
		const n = x_labels.length;
		var corr_data = [];
		d3.range(n).forEach((d,i) => {
			corr_data[i] = d3.range(n).map(j => {
				return {x: i,
					x_label: x_labels[i],
					y: j,
					y_label: x_labels[j],
					z: dec[matrix_type].r[i][j],
					n: dec[matrix_type].n[i][j]}});
		});

		d3.selectAll('.row')
			.data(corr_data)
			.each(function(row,i){
				d3.select(this).selectAll('rect')
					.data(row.map(d => { return d}))
					.attr('fill',function(d){return color(d.z)})
			})

		// set the current value of gene search batch dropdown
		var batch_opts;
		if(get_dataset_idx()){
			batch_opts = ['outbred - batch 1'];
		} else {
			batch_opts = ['inbred - batch 1','inbred - batch 2'];
		}
		var batch_dropdown = d3.select('#batch-select-dropdown').selectAll('option').data(batch_opts);
		batch_dropdown
				.enter()
			.append('option')
				.attr('value',function(d){ return d })
				.text(function(d){ return d })
				

		batch_dropdown.exit().remove();
		batch_dropdown
			.attr('value',function(d){ return d })
			.text(function(d){ return d });

		d3.select('#batch-select-dropdown')
			.on('change',function(){ 

				init_enrichment_table();

				// update gene search
				if(d3.select('#gene-result-textbox').select('div[selected=true]').size()){
					d3.select('#gene-result-textbox').select('div[selected=true]').nodes()[0].click();
				}
			})

		var batch_menu = d3.select('#batch-select-dropdown').nodes()[0];
		batch_menu.value = batch_opts[0];
		batch_menu.dispatchEvent(new Event('change', {value: batch_opts[0]}))
		batch_menu.click();

	// update gene search
	if(d3.select('#gene-result-textbox').select('div[selected=true]').size()){
		d3.select('#gene-result-textbox').select('div[selected=true]').nodes()[0].click();
	}
}


d3.json("data/decathlon.json").then(function(dec){


	// initialize dataset selection dropdown menu
	dataset_names = ['inbred-full','outbred-full','inbred-distilled','outbred-distilled'];
	d3.select('#matrix-header').select('select')
		.selectAll('option')
			.data(dataset_names)
			.enter()
		.append('option')
			.attr('value', function(d,i){ return i })
			.text(function(d){ return d })

	d3.select('#matrix-header')
		.select('select')
			.data([dec])
			.on('change', function(d){
				const dataset_idx = parseInt(d3.select(this).nodes()[0].value,10);
				const matrix_type = d3.select(this)
					.selectAll('option')
					.filter(function(t,i){ return i === dataset_idx})
					.nodes()[0].innerHTML.split('-')[1];

				var prev_matrix_type;
				if(d3.select('#matrix-svg').selectAll('rect').size()>3000){
					prev_matrix_type = 'full';
				} else {
					prev_matrix_type = 'distilled';
				}
				if( matrix_type === prev_matrix_type){
					update_page_dataset(d[dataset_idx%2],matrix_type)
				} else {
					init_page_from_dataset(d[dataset_idx%2],matrix_type);
				}
				})

	// initialize page at start with inbred-full dataset
	init_page_from_dataset(dec[0],'full');
	init_enrichment_table();

});

d3.select('.mouseover-textbox').raise()
d3.select('#svg-container')
	.on('mouseout',function(d){ d3.select('#hover-rect').style('stroke-opacity',0) })






	


