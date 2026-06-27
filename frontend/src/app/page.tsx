"use client";

import Image from "next/image";
import Logo from "../components/logo/logo";
import Home from "../components/home/home";
import About from "../components/about/about";
import Locations from "../components/locations/locations";
import Contact from "../components/contact/contact";
import GetInvoled from "../components/get_involved/get_involved";
import { useEffect, useState } from "react";

export default function Page() {
  const [homePageActive, setHomePageActive] = useState(true);
  const [aboutPageActive, setAboutPageActive] = useState(false);
  const [locationsPageActive, setLocationsPageActive] = useState(false);
  const [contactPageActive, setContactPageActive] = useState(false);
  const [getInvolvedPageActive, setGetInvolvedPageActive] = useState(false);

  const unselectedClassPages = "text-xl font-bold text-gray-500 hover:text-gray-700 cursor-pointer";
  const selectedClassPages = "text-xl font-bold text-blue-500 cursor-pointer";

  const [message, setMessage] = useState("");
  
  
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/data`)
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => console.error(err));
  }, []);

  console.log("Message from API:", message);

  return (
    <>
    <div className="w-full p-4 flex items-center" id="navbar">
      <Logo />
      <nav className="flex-1 flex justify-evenly ml-8">
        <h2 className={homePageActive ? selectedClassPages : unselectedClassPages} id="home" onClick={() => {
          setHomePageActive(true);
          setAboutPageActive(false);
          setLocationsPageActive(false);
          setContactPageActive(false);
          setGetInvolvedPageActive(false);          
        }}>Home</h2>
        <h2 className={aboutPageActive ? selectedClassPages : unselectedClassPages} id="about" onClick={() => {
          setHomePageActive(false);
          setAboutPageActive(true);
          setLocationsPageActive(false);
          setContactPageActive(false);
          setGetInvolvedPageActive(false);
        }}>About</h2>
        <h2 className={locationsPageActive ? selectedClassPages : unselectedClassPages} id="locations" onClick={() => {
          setHomePageActive(false);
          setAboutPageActive(false);
          setLocationsPageActive(true);
          setContactPageActive(false);
          setGetInvolvedPageActive(false);
        }}>Locations</h2>
        <h2 className={contactPageActive ? selectedClassPages : unselectedClassPages} id="contact" onClick={() => {
          setHomePageActive(false);
          setAboutPageActive(false);
          setLocationsPageActive(false);
          setContactPageActive(true);
          setGetInvolvedPageActive(false);
        }}>Contact</h2>
        <h2 className={getInvolvedPageActive ? selectedClassPages : unselectedClassPages} id="get-involved" onClick={() => {
          setHomePageActive(false);
          setAboutPageActive(false);
          setLocationsPageActive(false);
          setContactPageActive(false);
          setGetInvolvedPageActive(true);
        }}>Get Involved</h2>
      </nav>
    </div>


    {/* Render the components based on the useState values */}
    {homePageActive && <Home /> }
    {aboutPageActive && <About />}
    {locationsPageActive && <Locations />}
    {contactPageActive && <Contact />}
    {getInvolvedPageActive && <GetInvoled />}


      
    </>
  );

}
