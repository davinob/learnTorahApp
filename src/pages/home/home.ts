import { Component, ViewChild } from '@angular/core';
import { NavController, Content } from 'ionic-angular';


@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {

  @ViewChild(Content) content: Content;
  
  constructor(public navCtrl: NavController) {
 }

}
