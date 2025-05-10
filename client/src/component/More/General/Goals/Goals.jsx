import { UserContext } from "../../../../context/UserContext";
import { useContext, useState } from "react";
import Footer from "../../../Footer";
import { Sheet } from 'react-modal-sheet';
import ClipLoader from "react-spinners/ClipLoader";
import { useNavigate, Link} from "react-router-dom";

export default function Goals()
{
    const loggedData = useContext(UserContext);

    return(
        <section className="container goals-container">
            <div className="goals-list">
                <ul className="list-settings">
                    <div className="list-headings">
                        <span>Hedefler</span>
                    </div>
                    <div className="list-items">  
                         <li><Link to="/macrogoals">Makro Hedefleri</Link></li>
                        <span><Link to="/macrogoals">&gt;</Link></span>
                     </div>

                    {/* <div className="list-items">
                        <li>E-posta</li>
                    </div> */}
                    
                </ul>
            </div>

            <Footer />
           
        </section>
    );
}
        
    