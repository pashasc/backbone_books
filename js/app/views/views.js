define(function (require) {
    var _ = require('underscore'),
      $ = require('jquery'),
      Backbone = require('backbone'),
      v = require('app/utils/variables'),
      C = require('app/collections/BookCollection'),
      M = require('app/models/BookModel'),
      bookTemplate = require('text!app/templates/book.html'),
      detailsTemplate = require('text!app/templates/details.html'),
      SearchView,
      loadMoreView,
      BookView,
      DescriptionView,
      DetailView,
      AllBooksView;

  SearchView = Backbone.View.extend({
    el: $("#search_form"), 

    //the DOM events specific to this view
    events: {
      "submit": "search", 
      "keyup": "searchAutocomplete"
    },

    //Show an initial query, just once on the first page load
    initialize: _.once(function() {
      this.queryApi('game of thrones',index='0');
    }),

    search: function( e ){
      var $value = $('#search_input').val();
      e.preventDefault();  
      //Remove previous search results
      $('#books').html('');
      //Do a search with the form input as the query
      this.queryApi($value, index='0');
    },

    browse: function( term ){
      $('#books').html(''); 
      //Do a search with query passed in from a function
      this.queryApi(term, index='0'); 
    },

    topics: function( terms ) {
      /*
      _.map(terms, function(num,key) { 
      }); */
    },

    doAjax: function ( url, data ) {
      return $.ajax({
        dataType: 'jsonp',
        data: data,
        cache: false,
        url: url
      });
    },

    queryApi: function( term, index ) {
      var url = 'https://www.googleapis.com/books/v1/volumes?',
          data = 'q='+encodeURIComponent(term)+'&startIndex='+index+'&maxResults='+v.NUM_BOOKS+'&key='+v.API_KEY+'&fields=totalItems,items(id,volumeInfo)';

      aj = this.doAjax(url, data);

      //When ajax is done
      aj.done(function () {
        var Books = new C.BookCollection(),
          data = aj.responseJSON;

        //Traverse the API response and put each JSON book into a model
        if (data) {
          _.each(data.items, function(item) { 
            item.volumeInfo = item.volumeInfo || {};
            item.volumeInfo.imageLinks = item.volumeInfo.imageLinks || {};
            item.volumeInfo.imageLinks.thumbnail = item.volumeInfo.imageLinks.thumbnail || '';
            if (item.volumeInfo.imageLinks.thumbnail) {
              var book = new M.BookModel(item);
              Books.add(book);
            }
          }); 
        }

        //Instantiate the AllBooksViews with a collection of books and render them
        var item = new AllBooksView({ collection: Books });
            item.render();
            //Append new books if the index isn't 0, otherwise replace old with the new
            index > 0 ? $("#books").append(item.el) : $("#books").html(item.el);
      });

      var more = new loadMoreView();
      more.render(term, index);
    },

    searchAutocomplete: function( e ) {
      var $searchForm = $('#search_input'),
        term = $searchForm.val(),
        url = 'https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(term)+'&maxResults=8&key='+v.API_KEY+'&fields=totalItems,items(accessInfo,volumeInfo)';

      //Autcomplete function from jQuery UI (http://jqueryui.com/autocomplete/)
      $searchForm.autocomplete({
        source: function( request, response ) {
          $.getJSON(url + '&callback=?', function(data) {
            var dropdown = [];
               _.each(data.items, function(item) { 
                var ele = {},
                  //Use the subtitles for the autocomplete, if they exist
                  subtitle = typeof item.volumeInfo.subtitle !== "undefined" ? ': '+item.volumeInfo.subtitle : '';
                  //Create an array of object attributes autocomplete can parse
                  ele = item.volumeInfo.title.concat(subtitle); 
                  dropdown.push(ele);
                });
              //Remove duplicates
              dropdown = _.uniq(dropdown);
              response(dropdown);
            }); 
          },
          select: function( event, ui ) {
            //Instantiate a new search view and populate the autocomplete with an API query
            var search = new SearchView();
            search.queryApi(ui.item.value, index='0');
          }
      });
    }
  });

  loadMoreView = Backbone.View.extend({
    el: $("#loading"),

    events: {
      "click": "morebooks"
    },

    render: function(term, index) {
      this.$el.find('.wrap-btn').remove();
      var countIndex = parseInt(index) + parseInt(v.NUM_BOOKS),
        morebtn = '<div class="wrap-btn" style="text-align: center;"><a data-index="'+countIndex+'" data-term="'+term+'" class="btn more-button" href="#"> <strong>&#43;</strong> Load some more books</a></div>';
        this.$el.append(morebtn);
    }, 

    morebooks: function(e) {
      var term = $('.more-button').data('term'),
        index = $('.more-button').data('index'),
        loadMore = new SearchView();
        e.preventDefault(); 
        loadMore.queryApi(term, index);
        loadMore.undelegate('#loading','click'); // Todo: do better garbarge collection
      }
  });

  AllBooksView = Backbone.View.extend({
    tagName: "ul",

    initialize: function(){
      //bind 'this' object to book method
      _.bindAll(this, "book");
    },

    render: function(){
      //Render each book in the collection
      this.collection.each(this.book); 
    },

    book: function(model) {
      var bookItem = new BookView({ model: model });
      bookItem.render();
      this.$el.append(bookItem.el);
    }
  });


  BookView = Backbone.View.extend({
    //each book goes in an html list tag
    tagName: "li",

    //cache the template function for a single item
    template: _.template(bookTemplate),

    //the DOM events specific to this view
    events: {
      "click": "clicked"
    },

    clicked: function(e){
      e.preventDefault();
      this.detail(this.model);
    },

    //populate the cached template and append to this html
    render: function(){
      var book = _.template(this.template(this.model.toJSON()));
      this.$el.append(book);
    },

    detail: function(model) {
      //Instantiate the book details view with the book model that was clicked on
      var bookDetail = new DetailView({ el: $("#book-details"), model: model });
      bookDetail.render();
      bookDetail.undelegate('.close detail','click');  //todo: better garbage collection
    }
  });

  DetailView = Backbone.View.extend({

    el: $("#book-details"),

    events: {
      "click .close-detail": "hide",
      "click #overlay": "hide"
    },

    initialize: function() {
      /* Add a faded overlay */
      this.$el.find('#overlay').remove(); //Remove previous overlay
      var overlay = '<div id="overlay" style="display: none;"></div>';
      this.$el.append(overlay).find('#overlay').fadeIn('slow');

      /* css3 transforms are buggy with z-index, need to remove them under overlay */
      this.$el.next().find('li').find('.book').addClass('removeTransform');

      /* Define JSON objects */
      this.model.attributes.description = this.model.attributes.description || {};
      this.model.attributes.volumeInfo = this.model.attributes.volumeInfo || {};
      this.model.attributes.volumeInfo.imageLinks = this.model.attributes.volumeInfo.imageLinks || {};
    },

    doAjax: function ( url, data ) {
      return $.ajax({
        dataType: 'jsonp',
        data: data,
        url: url
      });
    },

    render: function() {
      var url = 'https://www.googleapis.com/books/v1/volumes/'+this.model.id,
          data = 'fields=accessInfo,volumeInfo&key='+v.API_KEY,

      aj = this.doAjax(url, data);

      aj.done(function () {
        var detail = new M.BookModel(aj.responseJSON),
          //Load the books model into the details template
          view = _.template(detailsTemplate, detail.toJSON());

          $("#book-details").find('#detail-view-template').remove();
          $("#book-details").append(view).find('#detail-view-template').show().addClass('down');

          var descToggle = new DescriptionView({ el: "#wrap-info" });
          descToggle.render();
          descToggle.undelegate('click .more, clck .less','click'); //todo: get rid of zombie views better
      });
    },

    hide: function(e) {
      e.preventDefault();
      this.$el.find('#detail-view-template').removeClass('down').addClass('up');
      this.$el.find('#overlay').fadeOut('slow');
      this.$el.next().find('li').find('.book').removeClass('removeTransform'); //CSS3 Transforms have odd z-index issue
    }
  });

  DescriptionView = Backbone.View.extend({

    events: {
      "click .more": "more",
      "click .less": "less"
    },

    render: function() {
      var adjustheight = 200,
        moreText = "More »";

      this.$el.find(".description").find(".more-block").css('height', adjustheight).css('overflow', 'hidden');
      this.$el.find(".description").append('<div class="hide-description overflow"><a href="#" class="more"></a></div>');
      this.$el.find("a.more").text(moreText);
    },

    more: function(e) {
      e.preventDefault();
      var lessText = "« Less";

      this.$el.find(".description").find(".more-block").css('height', 'auto').css('overflow', 'visible');
      this.$el.find(".hide-description").removeClass('overflow');
      this.$el.find("a.more").text(lessText).addClass('less');
    },

    less: function(e) {
      e.preventDefault();
      var adjustheight = 200,
        moreText = "More »";

      this.$el.find(".description").find(".more-block").css('height', adjustheight).css('overflow', 'hidden');
      this.$el.find(".hide-description").addClass('overflow');
      this.$el.find("a.more").text(moreText).removeClass('less');
    }
  });

  // public API
  return {
    SearchView: SearchView,
    loadMoreView: loadMoreView,
    BookView: BookView,
    DescriptionView: DescriptionView,
    DetailView: DetailView,
    AllBooksView: AllBooksView
  };

});